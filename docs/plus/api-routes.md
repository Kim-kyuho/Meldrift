# Route Handler 상세설계

소스: `app/api/boards/route.ts`, `app/api/boards/[boardId]/route.ts`, `app/api/boards/[boardId]/markdown/route.ts`, `app/api/cards/layer/route.ts`, `app/api/drawings/[boardId]/route.ts`, `app/api/memos/route.ts`, `app/api/memos/[id]/route.ts`, `app/api/images/route.ts`, `app/api/images/[id]/route.ts`, `app/api/mermaids/route.ts`, `app/api/mermaids/[id]/route.ts`, `app/api/tables/route.ts`, `app/api/tables/[id]/route.ts`

Free Edition에는 이 계층이 없다. 브라우저 SQLite 워커가 같은 자리를 대신한다.

인증·미리보기·AI 경로는 [인증](./authentication.md), [보드 미리보기](./board-preview.md), [AI 어시스턴트](./ai-assistant.md)에서 다룬다. 공통 예외처리 골격은 [API Route 예외처리](../snippets/api-route-patterns.md)에 있다.

## 전체 목록

| 경로 | 메서드 | 권한 |
| --- | --- | --- |
| `/api/boards` | POST | 관리자 |
| `/api/boards/[boardId]` | PATCH, DELETE | 관리자 |
| `/api/boards/[boardId]/markdown` | GET | 없음 |
| `/api/boards/[boardId]/preview` | PUT | 카드 편집 |
| `/api/cards/layer` | POST | 카드 편집 |
| `/api/drawings/[boardId]` | GET | 없음 |
| `/api/drawings/[boardId]` | PATCH | 카드 편집 |
| `/api/memos`, `/api/images`, `/api/mermaids`, `/api/tables` | POST | 카드 편집 |
| `/api/memos/[id]`, `/api/images/[id]`, `/api/mermaids/[id]`, `/api/tables/[id]` | PATCH, DELETE | 카드 편집 |

읽기 경로(GET)에는 권한 검사가 없다. 쓰기 경로만 `getCardPermissionMessage`를 통과해야 한다.

## 공통 응답

| 상황 | 상태 | 본문 |
| --- | --- | --- |
| 성공 | 200 | `{ ok: true, ... }` |
| 권한 없음 | 403 | `{ ok: false, message }` |
| 본문·id 형식 오류 | 400 | `{ ok: false, message: "Invalid request body." }` 등 |
| 대상 없음 | 404 | `{ ok: false, message }` |
| 예외 | 500 | 일반 문구. 상세는 서버 로그로만 |

500 문구는 내부 사정을 드러내지 않는다. `console.error`로만 남긴다.

## 카드 CRUD

메모·이미지·머메이드·표 여덟 경로가 같은 골격을 쓴다.

```text
POST   /api/{종류}        새 카드. 성공 시 생성된 행을 통째로 돌려준다
PATCH  /api/{종류}/[id]   내용·좌표·크기 갱신
DELETE /api/{종류}/[id]   삭제
```

POST가 행을 `returning()`으로 돌려주는 이유는 **DB가 발급한 id를 화면이 받아야** 하기 때문이다. 화면은 그 id로 임시 카드를 교체한다. Free는 이 왕복이 없어 클라이언트가 id를 발급한다.

### 본문 검증

좌표는 `Number.isFinite`, 크기는 그 위에 양수까지 본다. `boardId`는 양의 정수여야 한다. 종류별 추가 검사는 다음과 같다.

| 종류 | 추가 검사 |
| --- | --- |
| memo | `content`가 문자열, `color`가 공백이 아닌 문자열 |
| mermaid | `source`가 문자열 |
| table | `source`가 `tableSourceSchema`를 통과 |
| image | 업로드 파일의 형식·크기 (상세는 [ImageCard](./image-card.md)) |

zod를 쓰는 곳은 표와 드로잉뿐이다. 나머지는 수동 검사다.

### 메모의 `sortOrder`

새 메모는 그 보드의 맨 뒤로 간다. 값을 클라이언트가 계산해 보내지 않고 INSERT 안에서 직접 구한다.

```sql
(SELECT COALESCE(MAX(sort_order), 0) + 1 FROM memos WHERE board_id = ?)
```

동시에 두 개가 만들어져도 서로 다른 값을 받는다.

## `/api/drawings/[boardId]`

| 메서드 | 동작 |
| --- | --- |
| GET | 획 배열을 돌려준다. 행이 없으면 `[]` |
| PATCH | `boardStrokesSchema`로 검증 후 upsert |

PATCH는 `onConflictDoUpdate`로 `board_id` 유일 제약에 맞춰 넣는다. 보드당 획 묶음이 한 행이므로 INSERT와 UPDATE를 구분하지 않는다. `updatedAt`도 함께 갱신한다.

획 검증은 `@meldrift/core/board-stroke`의 스키마를 그대로 쓴다. 브라우저와 서버가 같은 규칙으로 판정한다.

## `/api/cards/layer`

카드 하나를 맨 앞/맨 뒤로 보내고 필요하면 전체 `z`를 다시 매긴다.

1. `boardId`·`id`가 양의 정수이고 `type`·`action`이 유효한지 검사한다. 판정은 `@meldrift/core/cards`의 `isCardType`/`isCardLayerAction`을 쓴다.
2. 보드의 카드를 네 테이블에서 모은다.
3. `front`면 `maxZ + 1`, `back`이면 최소보다 아래 값을 준다.
4. 최대 `z`가 `normalizeThreshold`(9000)를 넘으면 전체를 `1..N`으로 다시 매긴다.

정규화 정렬은 `z` → `cardTypeOrder` → `id` 순이다. 새 카드가 전부 `z = 1`이라 동률이 흔하므로 이 tiebreak가 상시 동작한다.

## `/api/boards`, `/api/boards/[boardId]`

보드 생성·이름 변경·삭제는 **관리자만** 할 수 있다. 권한이 없으면 각각 다른 문구로 403을 돌려준다.

| 경로 | 검증 |
| --- | --- |
| POST | `title`이 공백이 아니고, `width`/`height`가 정수, `ownerId`가 있어야 한다 |
| PATCH | `boardId`가 양의 정수. 바꿀 필드가 하나도 없으면 400 `No update fields were provided.` |
| DELETE | 보드가 없으면 404 |

보드를 지우면 카드와 드로잉은 FK `ON DELETE CASCADE`로 함께 사라진다.

## `/api/boards/[boardId]/markdown`

문서 컴파일을 **SQL 한 번으로** 처리한다. 메모의 네 꼭짓점을 `CROSS JOIN LATERAL VALUES`로 펼치고, 카드를 `UNION ALL`로 모아 포함 여부로 조인한 뒤, `ROW_NUMBER() OVER (PARTITION BY memo_id, corner_order ORDER BY z DESC, card_type ASC, card_id ASC)`로 꼭짓점마다 한 장만 남긴다.

응답 행을 이어 붙이는 단계에서 이미 쓴 카드를 `Set`으로 걸러 한 카드가 두 번 나오지 않게 한다.

같은 규칙의 TypeScript 구현이 Free의 `apps/free/lib/board-markdown.ts`에 있다([Free Markdown 컴파일](../free/markdown-export.md)). **두 구현은 서로 다른 언어로 같은 규칙을 적은 것이므로 한쪽만 고치면 두 Edition의 문서가 갈라진다.**

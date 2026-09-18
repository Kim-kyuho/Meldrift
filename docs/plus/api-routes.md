# Route Handler 상세설계

소스: `app/api/boards/route.ts`, `app/api/boards/[boardId]/route.ts`, `app/api/boards/[boardId]/markdown/route.ts`, `app/api/boards/[boardId]/snapshot/route.ts`, `app/api/boards/[boardId]/snapshot/images/[imageId]/route.ts`, `app/api/editor-lease/route.ts`, `proxy.ts`

Free Edition에는 이 계층이 없다. 브라우저 SQLite 워커가 같은 자리를 대신한다.

인증·미리보기·AI 경로는 [인증](./authentication.md), [보드 미리보기](./board-preview.md), [AI 어시스턴트](./ai-assistant.md)에서 다룬다. 스냅샷 경로의 동작은 [보드 스냅샷](./board-snapshot.md)에 있고 여기서는 계약만 적는다. 공통 예외처리 골격은 [API Route 예외처리](../snippets/api-route-patterns.md)에 있다.

## 살아 있는 경로

| 경로 | 메서드 | 권한 |
| --- | --- | --- |
| `/api/boards` | POST | 관리자 |
| `/api/boards/[boardId]` | PATCH, DELETE | 관리자 |
| `/api/boards/[boardId]/snapshot` | GET | 없음 |
| `/api/boards/[boardId]/snapshot` | PUT | 카드 편집 + 편집 리스 |
| `/api/boards/[boardId]/snapshot/images/[imageId]` | GET | 없음 |
| `/api/boards/[boardId]/markdown` | GET | 없음 |
| `/api/boards/[boardId]/preview` | PUT | 카드 편집 |
| `/api/editor-lease` | POST, DELETE | 카드 편집 |

읽기 경로(GET)에는 권한 검사가 없다. 쓰기 경로만 `getCardPermissionMessage`를 통과해야 한다.

## 410으로 막힌 경로

카드별 저장 경로는 `proxy.ts`가 쓰기 메서드를 가로챈다.

```text
/api/memos/*      /api/images/*     /api/mermaids/*
/api/tables/*     /api/drawings/*   /api/cards/layer

POST · PATCH · PUT · DELETE → 410 Gone
  "Card-by-card saving is no longer supported. Reload the board to use snapshot saving."
```

읽기는 통과시킨다. 스냅샷이 아직 없는 보드를 열 때 마이그레이션이 이 테이블들을 읽어야 한다.

라우트 파일 자체는 남아 있다. 지우면 옛 클라이언트가 404를 받고 왜 실패했는지 알 수 없다.

## 공통 응답

| 상황 | 상태 | 본문 |
| --- | --- | --- |
| 성공 | 200 | `{ ok: true, ... }` |
| 권한 없음 | 403 | `{ ok: false, message }` |
| 본문·id 형식 오류 | 400 | `{ ok: false, message }` |
| 대상 없음 | 404 | `{ ok: false, message }` |
| 스냅샷 초과 | 413 | `{ message }` |
| 판 번호·리스 불일치 | 409 | `{ message }` |
| 예외 | 500 | 일반 문구. 상세는 서버 로그로만 |

500 문구는 내부 사정을 드러내지 않는다. `console.error`로만 남긴다.

## `/api/boards/[boardId]/snapshot`

### GET

저장된 스냅샷이 있으면 SQLite 바이트를 그대로 내려준다.

```text
Content-Type: application/vnd.sqlite3
X-Snapshot-Revision: {판 번호}
X-Snapshot-Mutation: {마지막 변경 id}
Cache-Control: no-store
```

없으면 카드 테이블에서 만든 JSON을 내려준다.

```json
{ "legacy": { "board": {}, "memos": [], "images": [] }, "revision": 0 }
```

클라이언트는 `Content-Type`으로 두 갈래를 가른다.

### PUT

본문이 SQLite 파일 바이트다. `maxDuration`은 60초다.

| 헤더 | 검증 |
| --- | --- |
| `X-Snapshot-Revision` | 0 이상의 안전한 정수 |
| `X-Snapshot-Mutation` | `^[a-zA-Z0-9:-]{1,160}$` |
| `X-Editor-Tab` | `^[a-zA-Z0-9-]{20,80}$` |

크기는 `Content-Length`와 실제 바이트 길이를 모두 본다. 헤더만 믿지 않는다.

내용 검증(`decodeSnapshot`)과 권한·판 번호 판정은 [보드 스냅샷](./board-snapshot.md)에 있다. 성공하면 `{ ok: true, revision }`이다.

## `/api/boards/[boardId]/snapshot/images/[imageId]`

저장된 스냅샷에서 이미지 한 장의 바이트를 꺼내 돌려준다. 서버가 만든 Markdown 문서가 이 경로를 링크한다.

사용자가 올린 바이트를 그대로 내보내므로 브라우저가 문서로 해석하지 못하게 막는다.

```text
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'none'; sandbox
Cache-Control: no-store
```

## `/api/boards/[boardId]/markdown`

두 경로가 한 라우트에 있다. 스냅샷이 있으면 그것을 쓰고, 없으면 옛 SQL 컴파일로 내려간다.

```text
저장된 스냅샷 있음
  → decodeSnapshot → compileBoardMarkdown (공유 코드)
  → 이미지는 /api/boards/{id}/snapshot/images/{imageId} 링크로 교체

없음
  → 카드 테이블을 SQL 한 번으로 컴파일 (아래)
```

스냅샷 경로는 Free 화면이 쓰는 것과 **같은 함수**를 쓴다. 두 Edition의 문서가 갈라질 여지가 없어졌다.

구버전 SQL 경로는 메모의 네 꼭짓점을 `CROSS JOIN LATERAL VALUES`로 펼치고, 카드를 `UNION ALL`로 모아 포함 여부로 조인한 뒤, `ROW_NUMBER() OVER (PARTITION BY memo_id, corner_order ORDER BY z DESC, card_type ASC, card_id ASC)`로 꼭짓점마다 한 장만 남긴다. 스냅샷으로 옮긴 보드에서는 더 이상 실행되지 않는다.

## `/api/editor-lease`

| 메서드 | 동작 |
| --- | --- |
| POST | `{ tabId }`로 60초 리스를 발급하거나 갱신한다. 남이 쥐고 있으면 409 |
| DELETE | `{ tabId }`로 자기 리스를 반납한다. 항상 204 |

`tabId`는 `^[a-zA-Z0-9-]{20,80}$`여야 한다. 자세한 판정 규칙은 [보드 스냅샷](./board-snapshot.md#리스)에 있다.

## `/api/boards`, `/api/boards/[boardId]`

보드 생성·이름 변경·삭제는 **관리자만** 할 수 있다. 권한이 없으면 각각 다른 문구로 403을 돌려준다.

| 경로 | 검증 |
| --- | --- |
| POST | `title`이 공백이 아니고, `width`/`height`가 정수, `ownerId`가 있어야 한다 |
| PATCH | `boardId`가 양의 정수. 바꿀 필드가 하나도 없으면 400 `No update fields were provided.` |
| DELETE | 보드가 없으면 404 |

DELETE는 Cloudinary 자산을 지운 뒤 삭제 일곱 개를 `db.batch`로 함께 보낸다. 스냅샷 행(`board_snapshots`)도 여기서 지운다. 카드 테이블은 FK `ON DELETE CASCADE`로도 지워지지만, 배치에 명시해 순서를 못 박는다.

# Route Handler 상세설계

소스: `app/api/boards/route.ts`, `app/api/boards/[boardId]/route.ts`, `app/api/boards/[boardId]/markdown/route.ts`, `app/api/boards/[boardId]/snapshot/route.ts`, `app/api/boards/[boardId]/snapshot/images/[imageId]/route.ts`, `app/api/boards/[boardId]/state/route.ts`, `app/api/boards/[boardId]/changes/route.ts`, `app/api/boards/[boardId]/uploads/**`, `app/api/boards/[boardId]/assets/**`, `app/api/boards/[boardId]/transition/route.ts`, `app/api/editor-lease/route.ts`, `proxy.ts`

Free Edition에는 이 계층이 없다. 브라우저 SQLite 워커가 같은 자리를 대신한다.

인증·미리보기·AI 경로는 [인증](./authentication.md), [보드 미리보기](./board-preview.md), [AI 어시스턴트](./ai-assistant.md)에서 다룬다. 스냅샷 경로의 동작은 [보드 스냅샷](./board-snapshot.md)에, `state`·`changes` 경로의 동작은 [변경분 동기화](./change-sync.md)에 있고 여기서는 계약만 적는다. 공통 예외처리 골격은 [API Route 예외처리](../snippets/api-route-patterns.md)에 있다.

## 살아 있는 경로

| 경로 | 메서드 | 권한 |
| --- | --- | --- |
| `/api/boards` | POST | 관리자 |
| `/api/boards/[boardId]` | PATCH, DELETE | 관리자 |
| `/api/boards/[boardId]/snapshot` | GET | 없음 |
| `/api/boards/[boardId]/snapshot` | PUT | 카드 편집 + 편집 리스 |
| `/api/boards/[boardId]/snapshot/images/[imageId]` | GET | 없음 |
| `/api/boards/[boardId]/state` | GET | 없음 |
| `/api/boards/[boardId]/changes` | GET | 없음 |
| `/api/boards/[boardId]/changes` | POST | 카드 편집 + 편집 리스 |
| `/api/boards/[boardId]/uploads` | POST | 카드 편집 + 편집 리스 |
| `/api/boards/[boardId]/uploads/[uploadId]` | GET | 카드 편집 + 편집 리스 |
| `/api/boards/[boardId]/uploads/[uploadId]/chunks/[index]` | PUT | 카드 편집 + 편집 리스 |
| `/api/boards/[boardId]/uploads/[uploadId]/complete` | POST | 카드 편집 + 편집 리스 |
| `/api/boards/[boardId]/assets/[assetId]` | GET | 없음 |
| `/api/boards/[boardId]/assets/[assetId]/bytes` | GET | 없음 |
| `/api/boards/[boardId]/assets/[assetId]/chunks/[index]` | GET | 없음 |
| `/api/boards/[boardId]/markdown` | GET | 없음 |
| `/api/boards/[boardId]/transition` | POST | 관리자 |
| `/api/boards/[boardId]/preview` | PUT | 카드 편집 |
| `/api/editor-lease` | POST, DELETE | 카드 편집 |

보드 내용을 읽는 경로에는 권한 검사가 없다. 쓰기 경로와 업로드 진행 상태 조회만 `getCardPermissionMessage`와 편집 리스를 통과해야 한다. 업로드 상태는 그 업로드를 시작한 계정에게만 보인다.

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

응답에는 항상 `X-Storage-Mode`가 붙는다. 클라이언트는 이것으로 보드를 어느 방식으로 열지 가른다.

이미 전환한 보드(`delta`)에는 스냅샷 바이트를 내려주지 않는다. 행은 복구용으로 남지만 되돌리는 경로는 만들지 않는다.

```json
{ "mode": "delta", "revision": 12 }
```

저장된 스냅샷이 있으면 SQLite 바이트를 그대로 내려준다.

```text
Content-Type: application/vnd.sqlite3
X-Snapshot-Revision: {판 번호}
X-Snapshot-Mutation: {마지막 변경 id}
X-Storage-Mode: snapshot
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

## `/api/boards/[boardId]/state`

바이너리를 뺀 보드 내용과 현재 판 번호를 JSON으로 내려준다.

```json
{ "ok": true, "revision": 12, "snapshot": { "board": {}, "memos": [], "images": [] } }
```

전환한 보드(`mode: "delta"`)는 카드 테이블에서 읽는다. 아직 전환하지 않은 보드는 저장된 스냅샷에서 읽고, 스냅샷이 없는 보드만 카드 테이블로 되돌아간다. 카드 테이블은 스냅샷 전환 이후 갱신되지 않으므로 그대로 읽으면 낡은 보드를 내려준다.

`images[].data`와 `images[].mimeType`은 항상 `null`이다. 바이트는 이 응답에 싣지 않고, 주소가 없는 이미지는 `url`이 `/api/boards/{id}/snapshot/images/{imageId}`로 채워진다.

## `/api/boards/[boardId]/changes`

### GET

`?mutationId=`로 그 묶음이 이미 반영됐는지 묻는다.

```json
{ "ok": true, "applied": true, "revision": 43 }
```

반영되지 않았으면 `applied: false`, `revision: null`이다. 보드를 열 때 응답을 못 받고 끝난 전송이 실제로는 서버에 닿았는지 가리는 데 쓴다. 판정만 하고 아무것도 바꾸지 않으므로 권한 검사가 없다.

### POST

변경분 묶음을 하나의 트랜잭션으로 반영한다. `maxDuration`은 60초다.

```json
{
  "baseRevision": 42,
  "mutationId": "0f1c9a2e-7b64-4d51-9c0a-3e8f5b21d774",
  "operations": [
    { "type": "memo", "syncId": "memo-1", "action": "update", "changes": { "x": 420, "y": 180 } }
  ]
}
```

| 항목 | 검증 |
| --- | --- |
| `X-Editor-Tab` | `^[a-zA-Z0-9-]{20,80}$` |
| `mutationId` | `^[a-zA-Z0-9:-]{1,160}$` |
| `operations` | 1개 이상 500개 이하 |
| 본문 크기 | `Content-Length`와 실제 바이트 길이 모두 1 MiB 이하 |

크기는 헤더만 믿지 않는다. 제한을 넘으면 413이다.

직렬화한 연산이 본문에 들어가지 않으면 클라이언트가 그것을 `application/json` 자산으로 먼저 올리고, `operations` 대신 `staged`만 보낸다.

```json
{ "baseRevision": 42, "mutationId": "0f1c9a2e-7b64-4d51-9c0a-3e8f5b21d774", "staged": true }
```

자산 id가 곧 `mutationId`다. 서버는 그 자산의 바이트를 읽어 `operations` 자리에 넣고, 그때만 연산 개수 상한이 2000이 된다. 자산이 없으면 이미 반영된 묶음인지 보고, 아니면 409로 다시 올리라고 한다. 커밋이 끝나면 그 자산을 지운다.

`asset`이 붙은 연산이 가리키는 자산이 서버에 확정돼 있지 않으면 409다. 필드 검증·커밋 조건·재전송 판정은 [변경분 동기화](./change-sync.md)에 있다. 성공하면 `{ ok: true, revision }`이다.

## `/api/boards/[boardId]/uploads`

이미지 바이너리를 청크로 나눠 올린다. 업로드 진행 상태는 전부 DB에 있다. 서버리스 프로세스의 메모리나 임시 파일에 두지 않는다.

| 경로 | 본문 | 응답 |
| --- | --- | --- |
| `POST /uploads` | `{ assetId, digest, byteLength, mimeType }` | `{ uploadId, chunkSize, chunkCount, received }` 또는 `{ complete: true }` |
| `GET /uploads/{uploadId}` | 없음 | `{ chunkSize, chunkCount, received, expired }` |
| `PUT /uploads/{uploadId}/chunks/{index}` | 바이너리 | `{ ok: true, index }` |
| `POST /uploads/{uploadId}/complete` | 없음 | `{ ok: true, assetId, complete: true }` |

`digest`는 파일 전체의 sha256 16진수다. 청크마다 `X-Chunk-Digest`로 그 조각의 sha256을 함께 보낸다. 길이나 체크섬이 어긋나면 400이고 아무것도 저장하지 않는다.

같은 `assetId`로 다른 `digest`를 주장하면 409다. 자산은 불변이다.

확정은 청크 개수·연속성·총 길이·전체 해시를 모두 DB에서 확인한 뒤에만 이뤄진다.

## `/api/boards/[boardId]/assets/[assetId]`

메타데이터는 JSON, 바이트는 청크 단위로 내려준다. 보드 데이터 응답에 바이너리를 묶지 않는다.

`/bytes`는 청크를 이어 붙여 한 번에 내려준다. 서버가 만든 Markdown처럼 한 주소로 참조해야 하는 곳만 쓴다. 단일 응답 제한을 넘는 자산에는 쓸 수 없다.

청크 응답은 스냅샷 이미지와 같은 방식으로 굳힌다.

```text
Content-Type: application/octet-stream
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'none'; sandbox
Cache-Control: no-store
```

## `/api/boards/[boardId]/transition`

보드 하나를 스냅샷 저장에서 변경분 저장으로 옮긴다. 관리자만 부를 수 있고 `maxDuration`은 60초다.

```json
{ "ok": true, "source": "snapshot", "revision": 12, "assets": 3,
  "counts": { "memos": 9, "images": 3, "mermaids": 0, "tables": 1, "strokes": 2 } }
```

옮긴 개수와 이미지 해시 확인에 실패하면 409이고, 그 보드는 `migrating`으로 남아 어느 저장 방식도 쓰지 못한다. 이미 옮긴 보드를 다시 부르면 409다. 절차는 [변경분 동기화](./change-sync.md)에 있다.

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

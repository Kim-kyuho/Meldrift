# 브라우저 데이터베이스 상세설계

소스: `packages/board/src/browser-db/client.ts`, `packages/board/src/browser-db/protocol.ts`, `packages/board/src/browser-db/worker.ts`, `packages/board/src/sqlite-codec.ts`

## 목적

SQLite WASM을 Web Worker에서 실행해 보드 하나를 브라우저 안에 보관한다. 두 Edition이 같은 계층을 쓴다.

- **Free**: 여기가 최종 저장소다. 브라우저를 떠나지 않는다.
- **Plus**: 여기가 1차 저장소이자 서버로 올릴 바이트의 출처다. 서버 동기화는 [보드 스냅샷](../plus/board-snapshot.md)이 다룬다.

## 계층

| 파일 | 실행 위치 | 역할 |
| --- | --- | --- |
| `client.ts` | 메인 스레드 | 워커 하나를 지연 생성하고 요청을 Promise로 감싼다 |
| `protocol.ts` | 공유 타입 | 요청·응답 메시지와 동기화 메타데이터 형태 |
| `worker.ts` | 워커 스레드 | SQLite 초기화, IndexedDB 영속화, 세이브 파일 검증 |
| `sqlite-codec.ts` | 양쪽 | 스키마, 마이그레이션, `readSnapshot`/`replaceSnapshot` |

DB 전체 직렬화가 저장마다 일어나므로 이 작업은 전부 워커에서 돈다. 메인 스레드는 `postMessage`만 한다.

`sqlite-codec.ts`가 워커 밖에 따로 있는 이유는 Plus 서버도 같은 읽기 코드를 쓰기 때문이다. 서버는 워커 대신 `sql.js`로 같은 파일을 열고 `readSnapshot`을 그대로 부른다.

## 데이터베이스 인스턴스

```ts
createBoardDatabase(storageName, board)
```

`storageName`이 IndexedDB 데이터베이스 이름이고, `board`가 비어 있을 때 넣을 기본 보드다.

| Edition | `storageName` |
| --- | --- |
| Free | `meldrift-free` (모듈 최상위에 싱글턴 하나) |
| Plus | `meldrift-plus:{이메일}:{boardId}` — 계정과 보드마다 따로 |

워커 하나는 한 저장소에만 붙는다. 다른 `storageName`이나 다른 `boardId`로 요청이 오면 `A worker cannot switch its board storage.`로 거부한다.

## 요청 프로토콜

| `type` | 입력 | 응답 |
| --- | --- | --- |
| `load` | 없음 | `BoardSnapshot` |
| `replace` | `snapshot`, `dirty` | 없음 |
| `export` | 없음 | `ArrayBuffer` (SQLite 파일 바이트) |
| `import` | `bytes: ArrayBuffer`, `revision` | 교체 후의 `BoardSnapshot` |
| `record` | 없음 | `{ bytes, sync }` |
| `acknowledge` | `generation`, `revision` | 없음 |
| `reset` | 없음 | 없음 |

요청마다 증가하는 `id`를 붙이고, 응답은 `{ id, ok: true, value }` 또는 `{ id, ok: false, error }`다. 클라이언트는 `pending` Map에서 `id`로 짝을 찾아 resolve/reject한다.

`import`는 `ArrayBuffer`를 transfer 목록에 실어 복사 없이 넘긴다. `export` 응답도 같은 방식으로 되돌린다.

Free는 `load`·`replace`·`export`·`import`·`reset`만 쓴다. `record`와 `acknowledge`는 서버 동기화가 있는 Plus만 쓴다.

## 동기화 메타데이터

IndexedDB의 `files` 스토어에 DB 바이트(`"database"`)와 나란히 `"sync"` 키로 함께 저장된다.

| 필드 | 의미 |
| --- | --- |
| `revision` | 서버가 마지막으로 확인해 준 판 번호 |
| `generation` | 로컬 변경이 일어날 때마다 1씩 오르는 카운터 |
| `dirty` | 아직 서버에 올라가지 않은 변경이 있는가 |
| `changedAt` | 마지막 로컬 변경 시각 |
| `mutationId` | 그 변경의 식별자(`crypto.randomUUID()`) |

`replace`에 `dirty: true`가 붙으면 `generation`이 오르고 새 `mutationId`가 발급된다. Free는 `dirty`를 세우지 않아 이 값들이 초기값에 머문다.

`acknowledge(generation, revision)`는 서버가 받아들인 판 번호를 기록하는데, **그 사이에 새 변경이 있었는지**를 `generation` 비교로 판단한다.

```text
dirty = (현재 generation !== 응답이 가리키는 generation)
```

업로드하는 동안 사용자가 카드를 또 옮겨도 그 변경이 "저장됨"으로 지워지지 않는다. 오프라인 동기화에서 가장 자주 틀리는 자리다.

## 워커 실행 모델

- `ensureInitialized()`가 `initialization` Promise를 한 번만 만든다. 모든 요청이 이것을 먼저 기다린다.
- `operationQueue`가 들어온 요청을 **직렬로** 잇는다. SQLite 핸들 하나를 여러 요청이 동시에 건드리지 않는다.
- 요청 처리 중 예외는 잡아서 `{ ok: false, error }`로 돌려준다. 워커는 죽지 않는다.

## 저장 구조

SQLite는 `:memory:`에서 돌고, IndexedDB는 그 바이트 스냅샷만 보관한다.

```text
시작    IndexedDB(storageName) files["database"] → sqlite3_deserialize → :memory: DB
편집    전부 메모리에서
저장    sqlite3_js_db_export → 바이트 → IndexedDB에 통째로 put
```

`persistDatabase()`는 `saveIndexedDbFile(exportDatabase(database))` 한 줄이다. **메모 한 글자를 고쳐도 DB 전체를 다시 직렬화해 저장한다.** IndexedDB는 값을 통째로 넣고 빼는 것만 되므로 부분 쓰기가 없다.

object store는 `files`, 키는 `"database"`와 `"sync"` 둘이다. 읽을 때 값이 `Uint8Array`로 돌아오는 경우도 있어 `ArrayBuffer`로 정규화한다.

`deserializeDatabase(bytes, writable)`는 `SQLITE_DESERIALIZE_FREEONCLOSE`에 쓰기 여부에 따라 `RESIZEABLE` 또는 `READONLY`를 더한다. 실패하면 할당한 포인터를 해제하고 DB를 닫은 뒤 던진다.

## 스키마

`boards`, `memos`, `images`, `mermaids`, `drawings`, `tables` 여섯 테이블이다. Plus의 Neon 스키마와 같은 모양이되 `users`가 없고 이미지가 URL 대신 BLOB을 갖는다. 정의는 `sqlite-codec.ts`의 `schemaSql` 한 곳에 있다.

```text
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = DELETE;
PRAGMA busy_timeout = 5000;
PRAGMA user_version = 3;
```

- 모든 카드 테이블이 `board_id`로 `boards`를 참조하고 `ON DELETE CASCADE`다.
- `drawings.board_id`는 `UNIQUE`다. 보드당 획 묶음이 한 행이다.
- `drawings.source`와 `tables.source`는 `CHECK (json_valid(source))`로 JSON임을 강제한다.
- `width`/`height`는 전부 `CHECK (> 0)`다.

## 마이그레이션

`PRAGMA user_version`을 현재 `schemaVersion`(3)과 비교한다. 같으면 `CREATE TABLE IF NOT EXISTS`만 다시 돌린다. 1 이상 3 이하가 아니면 `Unsupported browser database version`으로 거부한다.

| 대상 | 하는 일 |
| --- | --- |
| `version < 2` | `images`에 `image_data BLOB`, `mime_type TEXT` 추가 |
| `version < 3` | `memos`에 `sort_order INTEGER NOT NULL DEFAULT 0` 추가 후 `UPDATE memos SET sort_order = id` |

3 미만 보드는 id 순서가 곧 탐색 순서였으므로 그 순서를 그대로 옮겨 담는다. 전체를 한 트랜잭션으로 돌리고 마지막에 `user_version`을 올린다.

## 읽기 (`readSnapshot`)

`readSnapshot(db, boardId)`는 `boards`에서 해당 행이 없으면 던진다. Free는 `boardId = 1`로, Plus는 서버 보드 id로 부른다.

배열 순서는 생성 순서(`ORDER BY id`)로 고정한다. 화면 순서와 문서 순서는 `sortOrder`가 정한다.

구버전 파일을 그대로 읽을 수 있도록 두 곳에서 컬럼 존재를 먼저 확인한다.

- `PRAGMA table_info(memos)`에 `sort_order`가 없으면 그 컬럼 없이 조회하고 저장 순서를 0으로 본다.
- `PRAGMA table_info(images)`에 `image_data`와 `mime_type`이 모두 있어야 BLOB을 읽는다. 없으면 `data`/`mimeType`을 `null`로 채운다.

메모 순서는 `@meldrift/core`의 `rankMemoOrders`로 다시 매긴다. 저장값이 전부 0인 구버전 파일도 화면 연번이 항상 1..N이 된다.

`tables.source`와 `drawings.source`는 `JSON.parse`한다. 획 행이 없으면 빈 배열이다.

마지막에 `parseBoardSnapshot`으로 전체를 검증해서 돌려준다.

## 쓰기 (`replaceSnapshot`)

부분 갱신이 없다. 한 트랜잭션 안에서 `DELETE FROM boards`로 시작하고(FK CASCADE로 카드가 전부 지워진다) 스냅샷 내용을 그대로 다시 넣는다.

id를 명시해 INSERT하므로 화면이 들고 있던 카드 id가 저장 후에도 바뀌지 않는다. `tables.source`는 `JSON.stringify`, 획은 `drawings` 한 행에 `drawing_id = 1`로 넣는다.

입력은 들어오자마자 `parseBoardSnapshot`으로 검증한다.

## 세이브 파일 불러오기 (`importDatabase`)

받은 바이트를 **읽기 전용**으로 열어 전부 통과한 뒤에야 현재 DB를 교체한다. 검사 순서는 다음과 같다.

1. 50 MiB 이하인가
2. 앞 16바이트가 `SQLite format 3\0`인가
3. `PRAGMA integrity_check`가 `ok`인가
4. `boards`·`memos`·`images`·`mermaids`·`drawings`·`tables`가 모두 있는가
5. `PRAGMA user_version`이 1~3인가
6. 보드가 정확히 하나이고 그 id가 이 워커의 보드 id인가
7. 카드 다섯 테이블에 다른 보드의 행이 없는가
8. `readSnapshot`이 통과하는가

통과하면 `replaceSnapshot` → `persistDatabase` 순으로 반영하고 새 스냅샷을 돌려준다. 이때 `sync`는 `{ revision, generation: 0, dirty: false }`로 초기화된다 — 받은 파일이 곧 기준이 된다. 어느 단계에서 실패하든 현재 DB는 손대지 않은 상태로 남는다. 임시로 연 DB는 `finally`에서 닫는다.

Plus 서버도 업로드된 스냅샷에 같은 성격의 검사를 한 번 더 한다. 목록은 [보드 스냅샷](../plus/board-snapshot.md)에 있다.

## 초기화와 리셋

초기화는 IndexedDB에 저장된 파일이 있으면 그것을 열고 `migrateDatabase`를, 없으면 빈 `:memory:` DB에 스키마를 적용한다. 이어서 기본 보드를 `INSERT OR IGNORE`로 보장하고 즉시 저장한다.

`reset`은 IndexedDB 데이터베이스를 삭제하고 현재 DB를 닫은 뒤 `initialization`을 `null`로 되돌린다. 다음 요청이 오면 빈 보드로 다시 초기화된다.

## 클라이언트 쪽 특이사항

- 워커는 첫 요청 때 한 번만 만든다. 워커 `error` 이벤트가 오면 대기 중인 모든 요청을 거부하고 워커를 종료·해제해 다음 요청 때 다시 만든다.
- 워커 생성 직후 `navigator.storage.persist()`를 호출한다. 실패는 무시한다. 저장소 축출을 줄이기 위한 요청이다.
- `resetInProgress`가 서면 이후 `replace`는 아무 일도 하지 않는다. 리셋 직후 화면이 남은 상태를 다시 저장해 되살리는 것을 막는다.
- `window`가 없으면 던진다. 서버 렌더 중에는 쓸 수 없다.

## 알려진 특이사항

`reset`은 IndexedDB를 지우고 `initialization`을 `null`로 되돌리지만 워커 모듈이 들고 있는 `sync` 변수는 되돌리지 않는다. 다음 초기화가 저장소에서 `sync`를 찾지 못해도 이전 값이 메모리에 남는다. 리셋을 쓰는 것은 Free뿐이고 Free는 `dirty`를 세우지 않아 지금은 드러나지 않는다. Plus에 리셋을 붙이면 그때 문제가 된다.

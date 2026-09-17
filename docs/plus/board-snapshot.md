# 보드 스냅샷 상세설계

소스: `components/BoardSnapshotClient.tsx`, `hooks/useBoardSnapshot.ts`, `lib/snapshot.ts`, `lib/snapshot-sync.ts`, `lib/snapshot-codec.ts`, `lib/saved-board-snapshot.ts`, `lib/legacy-board-snapshot.ts`, `app/api/boards/[boardId]/snapshot/route.ts`, `app/api/editor-lease/route.ts`, `proxy.ts`

## 무엇이 바뀌었나

Plus는 카드 하나를 고칠 때마다 Route Handler를 부르고 DB 행 하나를 갱신했다. 지금은 **보드 전체가 SQLite 파일 한 장**이고, 그 파일이 통째로 오간다.

| | 이전 | 지금 |
| --- | --- | --- |
| 저장 단위 | 카드 한 장 | 보드 전체(SQLite 파일) |
| 저장 시점 | 카드 조작마다 즉시 | 로컬 즉시, 서버는 3초 뒤 |
| 서버 보관 | `memos`/`images`/… 테이블 행 | `board_snapshots.snapshot` (bytea) |
| 이미지 | Cloudinary `secure_url` | 스냅샷 안의 BLOB |
| 오프라인 | 불가 | 브라우저 DB가 1차 저장소 |
| 동시 편집 | 막지 않음 | 계정당 탭 하나 |

Free와 같은 코드가 화면과 브라우저 DB를 담당하고([브라우저 데이터베이스](../shared/browser-database.md)), 이 문서는 그 위에 얹힌 서버 동기화를 다룬다.

## 고정값 (`lib/snapshot.ts`)

| 이름 | 값 | 의미 |
| --- | --- | --- |
| `maxSnapshotBytes` | 4 MiB | 서버가 받는 스냅샷 상한 |
| `snapshotDelayMs` | 3000 | 마지막 변경 후 업로드까지 기다리는 시간 |
| `snapshotFormatVersion` | 3 | 저장된 스냅샷의 형식 판 |

## 단일 편집자

같은 계정이 두 곳에서 같은 보드를 고치면 나중 것이 앞선 것을 덮는다. 그래서 편집 자리를 하나로 묶는다. 세 겹이다.

| 겹 | 수단 | 막는 것 |
| --- | --- | --- |
| 브라우저 | Web Locks `meldrift-plus-editor:{이메일}` | 같은 브라우저의 다른 탭 |
| 서버 | `editor_leases` 테이블 (60초) | 다른 기기·다른 브라우저 |
| 쓰기 | `PUT`의 SQL 한 문장 | 위 둘을 통과했더라도 만료된 리스 |

### 리스

```text
POST /api/editor-lease   { tabId }   → 60초 리스 발급/갱신
DELETE /api/editor-lease { tabId }   → 반납
```

`tabId`는 `sessionStorage`에 계정별로 보관하는 UUID다. 탭을 새로고침해도 같은 값이 유지되므로, 새로고침이 자기 자신과 충돌하지 않는다.

발급은 upsert 한 문장이고, 다음 중 하나일 때만 남의 리스를 가져온다.

- 기존 리스가 만료됐다
- 세션 해시가 다르다 (로그인을 다시 했다)
- `tab_id`가 같다 (자기 자신의 갱신이다)

어느 것도 아니면 아무 행도 돌아오지 않고 `409`와 함께 `This account is already editing in another tab.`이 된다.

클라이언트는 20초마다 갱신하고, 창이 포커스를 받으면 즉시 한 번 더 갱신한다. 절전으로 타이머가 밀린 탭이 돌아왔을 때 만료된 리스로 계속 쓰는 것을 막는다.

## 동기화 (`SnapshotSync`)

```text
save(snapshot)
  → 브라우저 DB에 쓰기 (dirty 표시, generation++, mutationId 발급)
  → 상태 "local"
  → 3초 뒤 업로드 예약

upload()
  → 큐가 빌 때까지 대기
  → dirty가 아니면 중단
  → 마지막 변경 후 3초가 안 지났으면 남은 시간만큼 다시 예약
  → 4 MiB를 넘으면 "로컬 저장됨" 문구만 남기고 중단
  → PUT (상태 "saving")
  → acknowledge(generation, revision) → 상태 "saved" 또는 "local"
```

로컬 쓰기는 `queue` 하나로 직렬화하고, 업로드는 `uploading` 플래그로 한 번에 하나만 돈다. 업로드 중에 들어온 변경은 큐 뒤에 붙고, 업로드가 끝나면 `dirty`가 다시 서 있으므로 이어서 한 번 더 올라간다.

### 상태

| 상태 | 화면 문구 | 의미 |
| --- | --- | --- |
| `saved` | Saved | 서버까지 올라갔다 |
| `local` | Saved locally | 브라우저에는 있고 서버에는 아직 |
| `saving` | Saving... | 올리는 중 |
| `error` | Server save failed | 올리기 실패. 10초 뒤 재시도 |
| `blocked` | 사유 문구 | 편집 자격을 잃었다. 재시도하지 않는다 |

`401`·`403`·`409`·`404`는 재시도하지 않고 `blocked`로 간다. 권한이나 리스나 판 번호가 어긋난 것이라 같은 요청을 다시 보내도 결과가 같다. 그 밖의 실패(네트워크, 5xx)만 10초 간격으로 재시도한다.

## 판 번호와 멱등성

업로드는 세 값을 헤더로 함께 보낸다.

```text
X-Snapshot-Revision   내가 알고 있는 마지막 판 번호
X-Snapshot-Mutation   이 변경의 식별자
X-Editor-Tab          이 탭의 id
```

서버는 `INSERT ... ON CONFLICT DO UPDATE` 한 문장으로 판정한다.

```sql
WHERE board_snapshots.revision = {보낸 판 번호}
   OR board_snapshots.mutation_id = {보낸 변경 id}
```

- 판 번호가 맞으면 받아들이고 `revision + 1`을 돌려준다.
- 판 번호는 어긋나지만 `mutation_id`가 같으면 **이미 받은 요청의 재시도**다. 판 번호를 올리지 않고 같은 값을 돌려준다.
- 둘 다 아니면 아무 행도 돌아오지 않고 `409`다.

응답 타임아웃으로 재시도한 요청이 두 판으로 세어지지 않는다. 클라이언트가 `acknowledge`에서 `generation`을 함께 넘기는 이유는 [브라우저 데이터베이스](../shared/browser-database.md#동기화-메타데이터)에 적었다.

## 서버가 스냅샷을 믿지 않는다

업로드된 바이트는 사용자가 만든 SQLite 파일이다. `decodeSnapshot`이 전부 통과해야 저장한다.

1. 4 MiB 이하인가 (`Content-Length`와 실제 바이트 둘 다)
2. 앞 16바이트가 `SQLite format 3\0`인가
3. `PRAGMA integrity_check`가 `ok`인가
4. `PRAGMA user_version`이 현재 `schemaVersion`인가
5. `boards` 행이 정확히 하나인가
6. 카드 다섯 테이블에 **다른 보드의 행이 없는가**
7. `readSnapshot`(공유 코드)이 통과하는가 — zod 검증까지 포함
8. 모든 이미지가 바이트를 들고 있는가

6번이 핵심이다. 이것이 없으면 자기 보드에 남의 `board_id`를 가진 행을 얹어 보낼 수 있다.

서버는 `sql.js`(asm.js 빌드)로 파일을 열고, 읽기는 공유 `readSnapshot`을 그대로 쓴다. 브라우저와 서버가 같은 코드로 같은 파일을 읽는다.

## 권한은 쓰기 한 문장 안에서 본다

`PUT`은 권한을 따로 조회하지 않는다. 세션·승인·리스·판 번호를 전부 INSERT의 `WHERE`에 넣는다.

```sql
FROM (SELECT board_id FROM boards WHERE board_id = ? FOR UPDATE) b,
     users u JOIN editor_leases e ON e.user_id = u.id
WHERE u.id = ? AND u.permission_flg = true
  AND u.session_token_hash = ? AND u.session_expires_at > now()
  AND e.session_hash = u.session_token_hash AND e.tab_id = ?
  AND e.expires_at > now()
```

확인과 쓰기 사이에 권한이 바뀔 틈이 없다. 조건이 하나라도 어긋나면 행이 돌아오지 않고 `409`가 된다.

## 불러오기 (`useBoardSnapshot`)

```text
1. 앞선 탭의 정리가 끝나기를 기다린다 (editorCleanup)
2. GET /api/me 로 편집 가능 여부를 본다
3. 편집 가능하면: Web Lock 획득 → tabId 확보 → 리스 발급 → 20초 하트비트
4. 브라우저 DB를 연다 (meldrift-plus:{이메일}:{boardId})
5. GET /api/boards/{id}/snapshot
6. 로컬과 서버를 맞춘다
7. 보드 메타데이터는 서버 값으로 덮는다
```

6번의 세 갈래는 이렇다.

| 로컬 상태 | 서버 응답 | 하는 일 |
| --- | --- | --- |
| dirty, 서버가 한 판 앞섬 + `mutationId` 일치 | SQLite | 내 마지막 업로드가 도착해 있었다. `acknowledge` 후 로컬을 쓴다 |
| dirty, 판 번호가 같음 | SQLite | 로컬을 쓰고 이어서 올린다 |
| dirty, 그 외 | SQLite | **충돌.** 로컬 백업을 받으라는 문구와 함께 `blocked` |
| 깨끗함 | SQLite | 판 번호가 같으면 로컬, 다르면 서버 파일을 `import` |
| 무관 | JSON(legacy) | 아래 마이그레이션 |

7번이 필요한 이유는 보드 이름이 Neon에만 있기 때문이다. 다른 곳에서 이름을 바꾼 뒤 옛 로컬 스냅샷을 열면 이름이 어긋난다.

## 구버전 보드 마이그레이션

스냅샷이 아직 없는 보드는 `GET`이 카드 테이블을 읽어 JSON으로 내려준다(`loadLegacySnapshot`). 편집 권한이 있는 사용자가 열면 그 자리에서 옮긴다.

```text
Cloudinary URL마다 fetch → prepareImageFile로 재압축 → data/mimeType로 교체
→ database.replace(snapshot, dirty: true) → 3초 뒤 서버로 올라간다
```

**Cloudinary 원본은 지우지 않는다.** 업로드가 성공해도 그대로 둔다. 옮기는 도중 실패하면 구버전 경로로 돌아갈 수 있어야 한다.

편집 권한이 없는 사람이 열면 이미지를 옮기지 않고 URL 그대로 본다.

## 구 API 차단 (`proxy.ts`)

카드별 저장 경로는 지웠지만 라우트는 남아 있다. 옛 화면을 띄워 둔 탭이 계속 쓰기를 보내면 스냅샷과 어긋난 데이터가 쌓인다.

```text
/api/memos/*, /api/images/*, /api/mermaids/*,
/api/tables/*, /api/drawings/*, /api/cards/layer
  → POST/PATCH/PUT/DELETE 는 410 Gone
```

읽기는 막지 않는다. 마이그레이션이 카드 테이블을 그대로 읽어야 한다.

## 복구 경로 (`BoardSnapshotClient`)

`blocked`가 되면 보드 위에 덮개를 씌우고 `inert`로 입력을 막은 뒤 세 갈래를 준다.

| 버튼 | 동작 |
| --- | --- |
| Download local backup | 브라우저 DB를 `.sqlite` 파일로 내려받는다 |
| Restore server version | 서버 판으로 로컬을 덮고 다시 연다 |
| Reload | 새로고침 |

로컬에만 있는 변경을 버리기 전에 손에 쥘 방법을 항상 남긴다. `Restore server version`은 `window.confirm`을 한 번 더 거친다.

## 이미지 내려받기

```text
GET /api/boards/{boardId}/snapshot/images/{imageId}
```

저장된 스냅샷을 열어 해당 이미지의 바이트를 돌려준다. 서버가 만든 Markdown 문서가 이 경로를 링크한다.

응답에 `X-Content-Type-Options: nosniff`와 `Content-Security-Policy: default-src 'none'; sandbox`를 붙인다. 사용자가 올린 바이트를 그대로 내보내는 경로라 브라우저가 그것을 문서로 해석하지 않게 막는다.

## 알려진 특이사항

- 이미지 한 장을 내주려고 **스냅샷 전체를 해독한다.** 캐시도 없다(`no-store`). 이미지가 N개인 문서를 컴파일하면 해독이 N번 일어난다.
- 업로드마다 서버가 최대 4 MiB SQLite를 asm.js로 열고 `integrity_check`를 돌린다. 편집이 잦으면 3초마다 그 비용이 든다.
- 리스는 계정당 하나다(`editor_leases.user_id`가 기본키). 같은 계정으로 **다른 보드**를 두 탭에서 여는 것도 막힌다.

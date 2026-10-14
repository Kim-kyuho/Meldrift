# 데이터베이스 접속과 스키마 상세설계

소스: `apps/plus/lib/db/index.ts`, `apps/plus/lib/db/schema.ts`, `apps/plus/drizzle/`

## 접속과 트랜잭션

`getDb()`는 `NEON_CONNECTION_STRING`으로 Neon HTTP 클라이언트와 Drizzle 인스턴스를 만든다. 연결 문자열이 없으면 오류를 발생시킨다. API가 인증·인가와 요청 검증을 수행한 뒤 DB에 접근한다.

대화형 트랜잭션을 전제로 하지 않는다. 변경분 커밋과 보드 삭제 등 함께 반영해야 하는 SQL은 지원되는 배치 트랜잭션 경로를 사용한다. DB 호출과 네트워크 요청이 무료이거나 비용이 없다는 의미는 아니다.

## 테이블 역할

| 테이블 | 역할 |
| --- | --- |
| `users` | 계정, 승인 상태, 단일 활성 세션의 토큰 해시와 만료 |
| `boards` | 보드 목록, 제목, 크기, 소유 정보, 미리보기 |
| `memos`, `mermaids`, `tables` | 카드 본문·좌표·크기·레이어와 보드별 `sync_id` |
| `images` | 이미지 카드 속성과 `asset_id`. 구버전 Cloudinary 정보도 호환용으로 보존 |
| `drawing_strokes` | 변경분 저장 방식의 획별 데이터 |
| `board_sync` | 보드별 revision, 형식 버전, `snapshot` / `migrating` / `delta` 모드 |
| `sync_mutations` | mutation ID, 요청 digest, 적용 결과를 보관해 중복 커밋 방지 |
| `assets`, `asset_chunks` | 이미지 등의 불변 자산 정보와 바이너리 청크 |
| `upload_sessions` | 분할 업로드 진행 상태와 완료·재개 검증 |
| `board_snapshots` | 이전 저장 방식의 보드별 SQLite 바이너리와 revision |
| `drawings` | 이전 방식의 보드당 한 행 드로윙 배열 |

현재 Neon 스키마에는 카드와 보드 사이의 FK 및 `ON DELETE CASCADE`가 선언되어 있지 않다. 보드 삭제 API에서 관련 행을 명시적으로 정리한다. 브라우저 SQLite의 FK 정책과 혼동하지 않는다.

## 저장 모드

`delta` 보드는 카드 테이블·획·자산이 서버 저장 데이터다. 변경된 필드만 수정하고 이미지 바이너리는 신규 추가·교체 때만 업로드한다. 기존 카드 CRUD URL이 410으로 차단되어 있어도 변경분 API의 카드 테이블 쓰기는 유지된다.

`snapshot` 보드는 기존 SQLite 전체 저장 경로를 사용한다. `board_snapshots`의 `snapshot`은 `bytea`, `format_version`은 스냅샷 전송 형식, `revision`과 `mutation_id`는 저장 충돌·재시도 판정에 사용한다. 현재 스냅샷 형식 버전 3과 브라우저 SQLite 스키마 버전 6은 서로 다른 값이다.

`bytea` 커스텀 타입은 Neon 드라이버의 16진 문자열 응답을 `Buffer`로 변환한다. 바이너리 자산은 별도 청크 경로로 전송하므로 보드 이동 때 전체 이미지를 다시 보낼 필요가 없다.

세부 흐름: [변경분 동기화](./change-sync.md), [호환용 스냅샷 저장](./board-snapshot.md), [API](./api-routes.md).

# 데이터베이스 접속과 스키마 상세설계

소스: `lib/db/index.ts`, `lib/db/schema.ts`, `docs/DB/schema.sql`

## 접속 (`getDb`)

```ts
neon(process.env.NEON_CONNECTION_STRING) → drizzle(client)
```

`@neondatabase/serverless`의 HTTP 드라이버를 쓴다. 커넥션 풀을 들고 있지 않아 서버리스 함수마다 새로 만들어도 비용이 없다. 그래서 `getDb()`는 **호출할 때마다 새 인스턴스를 만든다.** 모듈 수준 싱글턴을 두지 않는다.

`NEON_CONNECTION_STRING`이 없으면 즉시 던진다. Route Handler의 `try`가 이를 받아 500으로 응답한다.

## 테이블

| 테이블 | 키 | 비고 |
| --- | --- | --- |
| `users` | `id` | `email`이 유일. 세션 토큰 해시와 만료를 같은 행에 둔다 |
| `boards` | `board_id` | `owner_id`, 크기 |
| `memos` | `id` | `sort_order` 보유 |
| `images` | `image_id` | `public_id`가 유일 |
| `mermaids` | `mermaid_id` | |
| `drawings` | `drawing_id` | `board_id`가 **유일** — 보드당 한 행 |
| `tables` | `table_id` | `source`가 `jsonb` |
| `board_snapshots` | `board_id` | 보드 하나가 한 행. SQLite 파일을 `bytea`로 담는다 |

카드 테이블은 전부 `board_id`로 `boards`를 참조하고 `ON DELETE CASCADE`다. 보드를 지우면 카드와 드로잉이 함께 사라진다.

### 카드 테이블의 현재 위치

**보드 내용의 정본은 `board_snapshots`다.** 카드 테이블은 스냅샷으로 옮기지 않은 구버전 보드를 위해 남아 있고, 쓰기 경로는 [`proxy.ts`가 410으로 막는다](./api-routes.md#410으로-막힌-경로). 새 보드는 이 테이블에 행을 만들지 않는다.

### `board_snapshots`

| 컬럼 | 의미 |
| --- | --- |
| `snapshot` | SQLite 파일 그대로. drizzle에는 `bytea` 커스텀 타입으로 정의했다 |
| `format_version` | 스냅샷 형식 판(현재 3) |
| `revision` | 낙관적 동시성 제어에 쓰는 판 번호 |
| `mutation_id` | 마지막으로 반영한 변경의 식별자. 재시도를 같은 변경으로 알아보는 열쇠 |

`bytea`가 커스텀 타입인 이유는 Neon HTTP 드라이버가 값을 `\x...` 16진 문자열로 돌려줄 때가 있어서다. `fromDriver`가 그것을 `Buffer`로 되돌린다.

판정 규칙은 [보드 스냅샷](./board-snapshot.md)에 있다.


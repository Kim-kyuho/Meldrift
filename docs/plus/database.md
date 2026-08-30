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

카드 테이블은 전부 `board_id`로 `boards`를 참조하고 `ON DELETE CASCADE`다. 보드를 지우면 카드와 드로잉이 함께 사라진다.

`z`는 네 카드 테이블 모두 `integer NOT NULL DEFAULT 1`이고 유일 제약이 없다. 따라서 새 카드는 전부 `z = 1`이고, 정렬 동률이 기본 상태다. 순서를 못박는 것은 `@meldrift/core`의 `cardTypeOrder`다.

`tables.source`는 `jsonb`에 `$type<TableSource>()`가 붙어 있다. 조회하면 문자열이 아니라 객체로 돌아온다.

## 인덱스

```text
memos_board_id_sort_order_idx  (board_id, sort_order)
```

메모 재정렬이 한 보드의 `sort_order` 구간만 읽고 쓰기 때문에 둔 복합 인덱스다.

## 마이그레이션

`drizzle-kit`으로 관리한다.

| 스크립트 | 동작 |
| --- | --- |
| `npm run db:generate` | 스키마 변경분으로 SQL 생성 |
| `npm run db:migrate` | 적용 |
| `npm run db:check` | 스키마와 마이그레이션 일치 확인 |
| `npm run db:studio` | 브라우저 탐색기 |

`docs/DB/schema.sql`은 현재 스키마의 참조 사본이다. 실행 대상이 아니라 읽기용이다.

Free Edition의 브라우저 SQLite는 이 스키마와 테이블 구성이 같되 `users`가 없고 이미지가 URL 대신 BLOB을 가진다. 버전 관리도 drizzle이 아니라 `PRAGMA user_version`을 직접 올리는 방식이다. [브라우저 데이터베이스](../free/browser-database.md)를 참조한다.

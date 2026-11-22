# 실시간 협업(Live) 상세설계

소스: `lib/live/**`, `app/api/boards/[boardId]/live/route.ts`, `app/api/boards/[boardId]/live/token/route.ts`, `app/api/boards/[boardId]/members/route.ts`, `hooks/useBoardLive.ts`, `scripts/live-dev-server.ts`, `packages/ui/src/features/collaboration/**`, `packages/board-data/src/remote-patch.ts`

## 무엇을 하나

여러 사람이 같은 `delta` 보드를 동시에 연다.

- 접속자 이메일과 커서를 실시간으로 보여 준다.
- 카드를 옮기거나 편집하는 동안에는 그 카드를 잠근다. 다른 사람 화면에는 사용자 색 테두리와 "kim · editing" 칩이 붙고, 그 카드를 누를 수 없다.
- 확정된 변경은 새로고침 없이 반영된다.
- 상대가 카드를 끄는 동안에는 그 위치가 점선 윤곽으로 보인다.

Live는 **협업 보드**(`boards.collab_flg = 1`)에서만 켜진다. 보드를 만들 때(`CreateBoardModal`)와 편집할 때(`RenameBoardModal`) "Collaboration"에서 고르며, 기본값은 일반 보드(0)다. 일반 보드는 클라이언트가 연결하지 않고, 토큰 라우트는 404, 서버 연결은 4404로 거절한다. 연결 중에 협업을 끄면 60초마다 하는 재검증에서 닫히고, 그 뒤로는 일반 보드처럼 동작한다. 보드 목록에는 "Live"로 표시된다.

`snapshot` 모드 보드와 Free Edition에는 Live가 없다. 공통 `BoardClient`의 `collaboration` prop이 없으면 기존 동작과 똑같다.

## 구조

```text
브라우저 ── WebSocket ──▶ /api/boards/:id/live   (Vercel Function, upgradeWebSocket)
   │                         인스턴스 허브 ── Redis: 접속자·잠금·키별 판 번호·pub/sub
   └── HTTP ──▶ POST /changes (잠금 검사 → 커밋 → commit 이벤트 발행)
               GET  /changes?after=R (놓친 변경 다시 받기)
```

WebSocket은 **알림과 조정**만 맡는다. 카드 값의 원본은 기존 [변경분 동기화](./change-sync.md)와 Neon이다. 함수가 최대 실행 시간에 닿아 끊겨도 데이터는 잃지 않는다.

## 공동 편집자

`board_members (board_id, user_id, role)`. `role`은 `editor` 또는 `viewer`다.

| 판정 | 함수 | 규칙 |
| --- | --- | --- |
| 읽기 | `canReadBoard` | 공개 ∨ admin ∨ 소유자 ∨ 멤버 |
| 카드 편집 | `canEditBoard`, `editorSessionGuard` | admin ∨ (승인 ∧ (소유자 ∨ editor 멤버)) |
| 보드 관리 | `canManageBoard`, `managerSessionGuard` | admin ∨ (승인 ∧ 소유자). 이름·공개 범위·삭제·공유·전환 |

보드 목록 카드의 메뉴에서 "Share"를 누르면 `ShareBoardModal`이 열린다. 기존 가입자만 이메일로 추가할 수 있다. 커밋 batch 안의 `editorSessionGuard`가 멤버 여부를 다시 보므로, 멤버에서 빼면 그 사람의 다음 커밋부터 바로 막힌다.

## 연결

1. 쿠키로 인증된 `POST /live/token`이 60초짜리 HMAC 토큰을 준다(`lib/live/token.ts`). 토큰에는 사용자 id, 세션 해시, 보드, `clientId`가 들어 있다.
2. 브라우저가 `${NEXT_PUBLIC_LIVE_URL 또는 같은 출처}/api/boards/:id/live?token=`으로 연결한다. Free 도메인 프록시를 거치지 않아도 되도록 쿠키 대신 토큰을 쓴다.
3. 서버는 토큰·Origin·보드 권한을 확인하고 업그레이드한다. 그 뒤 60초마다 세션과 권한을 다시 조회해, 바뀌었으면 4401·4403으로 닫는다.
4. `hello` → `welcome`(접속자·잠금·최신 판 번호).

연결 수명은 `maxDuration`(현재 300초)이다. 서버가 30초 전에 `rotate`를 보내면, 클라이언트는 같은 `clientId`로 새 소켓을 열고 `welcome`을 받은 뒤 옛 소켓을 4000으로 닫는다. 그래서 접속자 표시와 잠금이 끊기지 않는다. 예상하지 못한 끊김은 1초에서 30초까지 지수 백오프로 다시 연결한다.

연결되기 전과 다시 연결하는 동안에는 편집을 멈춘다. 토큰 요청이 404(Live 꺼짐)이면 Live 없이 기존처럼 동작한다.

**대체 모드(`unavailable`).** 10초 동안 연결되지 않으면(Redis 장애, 서버 오류, 응답 없음) Live 없이 일반 보드처럼 편집을 허용한다(`liveFallbackMs`). 남의 잠금 정보는 비우고, 잠금 요청은 기다리지 않고 바로 통과시킨다. 접속자 막대는 빨간 점과 "Live collaboration unavailable"을 보여 준다. 뒤에서는 계속 다시 연결하고, 연결되면 그때 쓰고 있던 카드의 잠금을 다시 잡는다. 대체 모드의 동시 편집은 일반 보드와 같아서, 같은 카드를 겹쳐 고치면 겹침 검사(409)로 한쪽이 멈춘다.

연결은 서버가 살아 있는 시간만큼 비용(Vercel Provisioned Memory)이 들기 때문에 두 가지로 줄인다.

- **비로그인 사용자는 연결하지 않는다.** 클라이언트가 런타임을 만들지 않고, 토큰 라우트는 401, 서버는 사용자 없는 토큰을 4401로 거절한다. 공개 보드의 게스트는 지금처럼 열 때 한 번 받은 상태를 본다.
- **10분 동안 입력이 없으면 끊는다.** 포인터·키보드·휠·터치 입력을 활동으로 본다(`liveLimits.idleDisconnectMs`). 숨겨진 탭도 입력이 없으므로 같은 규칙으로 끊긴다. 상태는 `idle`이고 접속자 목록에서 빠진다. 다음 입력에서 다시 연결하고, `welcome.head`로 놓친 변경을 로그에서 채운다. 다시 연결되는 동안에는 편집을 잠깐 멈춘다. 쉬는 동안 쥐고 있던 잠금은 TTL로 풀리며, 돌아왔을 때 아직 비어 있으면 다시 잡는다.

메시지 스키마·종료 코드·제한은 `lib/live/protocol.ts` 한 곳에 있고, 서버와 클라이언트가 함께 쓴다.

## 잠금

키는 `touchedKeys(operation)`(`board-delta.ts`)가 정한다.

| 키 | 관할 |
| --- | --- |
| `memo:<syncId>` 등 | 카드 하나. 메모는 `sortOrder`를 뺀 필드 |
| `order:memo` | 메모 `sortOrder`(순서 패널) |
| `layer:strokes` | 기존 획 수정·삭제(지우개). 새 획은 잠금이 필요 없다 |
| `board:*` | Import·Reset. 다른 사람의 잠금이 없을 때만 잡힌다 |

**획득.** 보드 화면이 지금 필요한 키를 매번 계산해 `syncDesired`로 넘긴다. 필요한 키는 카드 위 포인터, 편집 중인 카드, 그룹 이동, 순서 패널 끌기, 지우개를 쓴 드로잉 모드에서 나온다. 새 키는 낙관적으로 요청한다. 편집 진입·그룹 삭제·Undo/Redo·Import/Reset은 `acquire`를 기다린 뒤 실행한다.

**미루기.** 남이 쥔 키, 응답을 기다리는 키, 직전 주인의 커밋을 아직 받지 못한 키는 `deferredKeys`다. 워커는 이 키들의 로컬 변경을 직전 저장 값으로 되돌린 채 diff한다(`deferKeys`). 잠금을 얻으면 `resave`가 그동안 쌓인 변경을 한 번에 기록한다. 거절되면 화면을 잠금 요청 직전 값으로 되돌린다. 그래서 거절된 변경이 outbox에 들어가는 일이 없다.

**해제.** 화면이 키를 놓아도 바로 풀지 않는다. 400ms가 지나고, 저장이 끝나고, outbox에 그 키를 건드리는 연산이 남아 있지 않을 때 푼다. 그동안 `ChangeSync.flushNow()`로 3초 디바운스를 건너뛰고 바로 보낸다.

**저장소.** Redis HASH `mdr:locks:{boardId}` 하나에 키별 `{holder, email, intent, expiresAt}`를 둔다. 획득·해제·연장·재주장·정리는 각각 Lua 스크립트 하나로 원자적으로 처리하고, 시각은 Redis `TIME`을 쓴다. 규칙은 `lock-rules.ts`의 `findConflict`와 같다. TTL은 20초이고, 연결이 살아 있으면 허브가 5초마다 연장한다.

**서버 강제.** `POST /changes`는 `X-Meldrift-Client`가 있으면, 커밋하기 전에 다른 holder가 쥔 키를 건드리는지 본다. 건드리면 `409 { code: "locked" }`. 잠금 검사와 커밋 알림은 각각 **2초 제한**(`liveStoreTimeoutMs`)이 있어, Redis가 죽었거나 느리면 기다리지 않고 통과한다. Redis 클라이언트는 끊긴 동안 명령을 쌓지 않고(`disableOfflineQueue`) 바로 실패한다. 마지막 방어선은 겹침 검사다.

## 커밋 조건

Live 클라이언트가 보낸 커밋은 판 번호가 정확히 같지 않아도 된다.

```sql
s.revision >= :base AND NOT EXISTS (
    SELECT 1 FROM sync_mutations m
    WHERE m.board_id = :board AND m.revision > :base
      AND m.author_client IS DISTINCT FROM :clientId
      AND m.touched && :touched)
```

`clientId`가 없으면 예전처럼 `s.revision = :base`다. 조건 값을 바꾸는 문장은 여전히 마지막 커밋 문장 하나뿐이다.

**보관 기간.** `sync_mutations`는 7일만 남긴다. Vercel Cron(`vercel.json`, 매일 18:00 UTC)이 `GET /plus/api/cron/sync-mutations`를 부르고, `CRON_SECRET`이 맞을 때만 7일 지난 행을 지운다. 지워진 구간보다 오래된 `baseRevision`(남은 최소 판 - 1보다 작은 값)으로 온 Live 커밋은 겹침을 판단할 수 없으므로 거절한다. 일주일 넘게 미전송 변경을 들고 있던 브라우저는 기존 충돌 안내(로컬 백업 내려받기)로 간다.

`sync_mutations`에 `touched`, `operations`, `author_id`, `author_client`를 기록한다. 스테이징한 큰 커밋도 연산을 같은 행에 남긴다(스테이징 자산은 커밋 뒤 지운다). digest는 연산만으로 계산한다. 이전 형식(판 번호 포함) digest도 같은 요청으로 인정한다.

## 원격 반영

```text
commit 이벤트(또는 GET /changes?after) → RemoteApplier
  ├ 내 커밋        → 판 번호만 올린다(advanceRevision)
  └ 다른 사람 커밋 → 새 이미지 내려받기 → 워커 applyRemote → 화면 패치 + 이력 투영
```

- `RemoteApplier`는 연속된 다음 판만 적용한다. 빈 판이 1초 동안 채워지지 않거나 이벤트에 연산이 없으면(32 KiB 초과) 로그에서 가져온다. 410이면 기존 충돌 화면으로 넘긴다.
- `ChangeSync`는 Live에서 `commitOutbox(…, null)`로 판 번호를 직접 올리지 않는다. 판 번호(`sync.revision`)는 "빈틈없이 반영한 마지막 판"이고, 커밋의 `baseRevision`이다.
- 워커 `applyRemote`는 SQLite와 diff 기준(`lastSaved`)을 함께 바꾸고 outbox는 만들지 않는다. 그 패치는 `remoteSeq`와 함께 32개까지 보관한다.
- 화면이 구독하기 전에 반영된 배치(보드를 여는 사이 들어온 변경)는 런타임이 모아 두었다가, 구독하는 순간 순서대로 넘긴다.
- Live 규칙은 첫 `welcome`에서 붙는다. 그때 워커의 판 번호를 다시 읽어 기준값을 맞춘다. 그 전에 기존 방식으로 커밋된 판을 원격 변경으로 다시 적용하지 않기 위해서다.
- 화면 스냅샷에는 `tagRemoteSeq`로 반영한 배치 번호를 붙인다. 이보다 늦게 도착한 로컬 저장은, 워커가 빠진 패치를 다시 적용한 뒤 diff한다. 원격 변경이 되돌아가는 에코가 생기지 않는다.
- 원격으로 바뀐 카드는 `key`를 바꿔 다시 마운트한다. 내가 쥔 카드는 다시 마운트하지 않는다.
- `useBoardHistory.projectRemote`가 보관 중인 모든 이력 상태에 같은 패치를 적용한다. 이웃한 상태의 차이에는 내 변경만 남으므로 Undo가 남의 변경을 되돌리지 않는다.
- 보드를 열 때 미전송 변경이 있고 판 번호가 다르면, 그 사이 로그를 받아 키가 겹치지 않는 한 이어 쓴다. 겹치면 기존 충돌 안내를 띄운다.

## 이메일 노출

소유자·관리자·공유 멤버만 다른 사람의 전체 이메일을 본다. 공개 보드에 들어온 비멤버 로그인 사용자에게는 서버가 보내기 전에 `k***@example.com`으로 가린다. 접속자 목록, 잠금 칩, 커밋 작성자, 변경 로그 모두에 같은 규칙을 적용한다.

## 환경 변수

| 변수 | 쓰는 곳 | 값 |
| --- | --- | --- |
| `LIVE_ENABLED` | Plus 서버 | `true`면 켠다. 없으면 토큰 404 → 기존 동작 |
| `REDIS_URL` | Plus 서버 | Vercel Marketplace Redis의 TCP URL(`redis://`·`rediss://`) |
| `LIVE_TOKEN_SECRET` | Plus 서버 | 토큰 HMAC 키. 운영에서는 필수다 |
| `LIVE_ALLOWED_ORIGINS` | Plus 서버 | 쉼표로 구분한 허용 Origin. 비우면 같은 호스트만 허용한다(개발은 모두 허용) |
| `LIVE_MAX_DURATION_SECONDS` | Plus 서버 | 회전 기준. `live/route.ts`의 `maxDuration`과 같은 값으로 맞춘다 |
| `NEXT_PUBLIC_LIVE_URL` | 빌드 | WebSocket 주소 앞부분. 예: `wss://plus.example.com/plus`. 없으면 같은 출처 |
| `CRON_SECRET` | Plus 서버 | 변경 로그 정리 Cron 인증. Vercel이 `Authorization: Bearer <값>`으로 보낸다. 없으면 정리하지 않는다 |

Pro 플랜에서 연결을 늘리려면 `maxDuration`(최대 800)과 `LIVE_MAX_DURATION_SECONDS`를 함께 바꾼다.

## 로컬 개발

`next dev`는 WebSocket 업그레이드를 처리하지 못한다(`upgradeWebSocket`은 Vercel 런타임이 필요하다). 그래서 같은 허브 코드를 별도 포트에 띄운다.

```bash
npm run dev:plus   # :3001
npm run dev:live   # :3002, 메모리 저장소
```

`apps/plus/.env.local`:

```text
LIVE_ENABLED=true
LIVE_DEV_BRIDGE_URL=http://127.0.0.1:3002/__live/bridge
```

`NEXT_PUBLIC_LIVE_URL`은 로컬에서 비워 둔다. 브라우저는 페이지와 같은 주소(`wss://localhost:3000/plus/api/boards/:id/live`, LAN이면 `wss://192.168.x.x:3000/...`)로 연결하고, Free 개발 서버가 개발 환경에서만 이 경로를 `LIVE_DEV_ORIGIN`(기본 `http://127.0.0.1:3002`)으로 넘긴다(`apps/free/next.config.ts`). 그래서 https 개발 서버, LAN·Tailscale 주소, 다른 기기에서도 이미 수락한 인증서와 출처로 연결된다. 개발 환경에서는 Origin 검사도 하지 않는다.

Next 프로세스의 커밋 라우트는 `LIVE_DEV_BRIDGE_URL`을 통해 개발 서버의 메모리 저장소로 잠금을 검사하고 이벤트를 발행한다. `REDIS_URL`을 주면 두 프로세스 모두 Redis를 쓴다.

연결이 안 되면 접속자 목록(우상단)의 노란 문구와 브라우저 콘솔의 `[live] …`, 터미널의 `live.refused …`에 이유가 나온다.

## 검증

- 단위: `tests/unit/live-store.test.ts`(저장소 계약, `REDIS_TEST_URL`을 주면 Redis Lua도 같은 테스트로 검사), `live-hub.test.ts`, `live-token.test.ts`, `changes-route.test.ts`, `packages/board-data/tests/remote-patch.test.ts`
- e2e: `npm run test:e2e:live --workspace=meldrift-plus`. 고정 DB에 공동 편집자와 `delta` 보드를 추가하고, 두 브라우저로 접속자·잠금·전파·동시 편집·퇴장을 확인한다.

## 아직 아닌 것

- 같은 카드의 동시 문자 편집, 획의 실시간 스트리밍
- AI 제안 수락 시 기존 카드 잠금. 남이 잠근 카드를 수정하는 제안은 커밋에서 409로 막힌다
- 관리자 강제 잠금 해제. 주인이 떠나면 TTL(최대 30초)로 풀린다
- 운영 Redis에서의 Lua 실측. 로컬 검증은 메모리 저장소로만 했다

# AI 잠금 상세설계

소스: `lib/ai/passcode.ts`, `lib/ai/unlock-throttle.ts`, `app/api/ai/unlock/route.ts`, `app/api/ai/status/route.ts`, `components/AiUnlockPanel.tsx`

## 목적

Free Edition에는 로그인이 없다. 그런데 AI 어시스턴트는 서버의 Gemini 키를 쓰므로 아무나 부르게 둘 수 없다. 사용자 계정 대신 **공유 비밀번호 하나**로 잠그고, 통과하면 서명한 토큰을 쿠키에 담는다.

Plus는 이 자리를 로그인 사용자와 권한 플래그가 대신한다.

## 왜 토큰을 쿠키에 담는가

세션 저장소가 없다. 서버가 기억하는 상태 없이 잠금 여부만 확인할 수 있어야 하므로, 만료 시각을 담아 서명한 토큰을 쿠키에 넣고 매 요청에서 서명을 다시 검사한다.

서명 키가 `AI_PASSWORD`에서 파생되므로 **비밀번호를 바꾸면 기존 쿠키가 전부 무효**가 된다.

## 토큰 형식

```text
v1.{만료 UNIX초}.{서명}
```

- 서명 키: `HMAC-SHA256("meldrift-free-ai", AI_PASSWORD)`
- 서명: `HMAC-SHA256(키, "v1.{만료}")`를 base64url로
- 유효 기간: `aiSessionMaxAgeSeconds` = 12시간

`verifyAiSessionToken`은 형식 오류·서명 불일치·만료를 **모두 같은 `false`**로 돌려준다. 이유를 구분해 주면 공격자에게 힌트가 된다.

토큰에 만료를 넣는 이유는 쿠키만으로는 부족해서다. 브라우저의 탭 복구로 세션 쿠키가 되살아나는 경우가 있다.

## 비교 방식

`equals`는 두 문자열을 그대로 비교하지 않는다. 각각을 `HMAC-SHA256("meldrift-free-compare", 값)`으로 다이제스트해 **길이를 맞춘 뒤** `timingSafeEqual`로 비교한다. 길이 차이로 정보가 새는 것을 막는다.

`verifyAiPassword`는 비밀번호가 설정되지 않은 서버에서 어떤 입력도 통과시키지 않는다.

## 쿠키

| 속성 | 값 |
| --- | --- |
| 이름 | `meldrift_ai` |
| `httpOnly` | `true` |
| `sameSite` | `strict` |
| `secure` | 프로덕션에서만 |
| `Max-Age` | 설정하지 않음 |

`Max-Age`가 없으므로 브라우저를 닫으면 사라지는 세션 쿠키다. 화면 문구도 `Unlocking lasts until this browser closes.`로 이 동작을 그대로 알린다. 개발은 http로 띄우므로 `secure`를 붙이면 쿠키가 저장되지 않아 프로덕션에서만 붙인다.

## 시도 제한

`lib/ai/unlock-throttle.ts`가 실패 횟수를 **인스턴스 메모리 Map**에만 센다. 완전 차단이 아니라 속도를 늦추는 용도다.

| 이름 | 값 |
| --- | --- |
| `maxFailedAttempts` | 5 |
| `lockoutWindowMs` | 5분 |

`firstFailureAt`로부터 5분이 지난 기록은 조회 시점에 버린다. 키는 `x-forwarded-for`의 첫 항목 → `x-real-ip` → `"unknown"` 순으로 고른다. 프록시 뒤에서는 소켓 주소가 모두 같아 전달 헤더를 먼저 본다.

서버 인스턴스가 여러 개거나 재시작하면 기록이 남지 않는다. 이 한계를 감수한 설계다.

## `POST /api/ai/unlock`

| 순서 | 조건 | 응답 |
| --- | --- | --- |
| 1 | `AI_PASSWORD` 또는 `AI_API_KEY` 미설정 | 503 `The AI assistant is not configured on this server.` |
| 2 | 시도 제한 걸림 | 429 |
| 3 | 본문 JSON 파싱 실패 | 400 `Invalid request body.` |
| 4 | 비밀번호가 문자열이 아니거나 0자 또는 200자 초과 | 400 `Enter the assistant password.` |
| 5 | 비밀번호 불일치 | 401 (남은 시도가 0이면 429와 같은 문구) |
| 6 | 통과 | 200 + 세션 쿠키 |

성공하면 실패 기록을 지운다. 200자 상한은 긴 입력으로 해시 연산을 유도하는 것을 막는다.

`DELETE /api/ai/unlock`은 같은 쿠키를 `maxAge: 0`으로 덮어 잠근다.

## `GET /api/ai/status`

잠금 쿠키가 `HttpOnly`라 브라우저 JS가 읽을 수 없다. 화면은 이 경로로 상태를 확인한다.

```text
{ ok: true, configured, unlocked, message }
```

- `configured`: `AI_API_KEY`와 `AI_PASSWORD`가 모두 있는가
- `unlocked`: `configured`이면서 쿠키의 토큰이 유효한가
- `message`: `configured`가 false일 때만 안내 문구

예외는 500과 함께 일반 문구를 돌려준다.

## `AiUnlockPanel`

비밀번호 입력만 받는다. 확인은 전부 서버가 한다.

- 화면 하단 중앙 고정, `onPointerDown`에서 `stopPropagation`으로 보드 패닝을 막는다.
- 제출 후 입력값을 즉시 비운다.
- `unlocking` 중에는 입력과 버튼을 비활성화하고 스피너를 보인다.
- 오류 문구는 서버가 준 것을 그대로 붉게 표시한다.

# 인증 상세설계

소스: `hooks/useBoardAuth.ts`, `lib/auth/session.ts`, `lib/auth/current-user.ts`, `lib/auth/password.ts`, `app/api/me/route.ts`, `app/api/signin/route.ts`, `app/api/signout/route.ts`, `app/api/signup/route.ts`

## 목적

난수 세션 토큰으로 로그인 상태를 확인하고, 사용자 승인 여부와 역할을 카드 편집 및 보드 관리 권한으로 변환한다. 한 사용자 행에는 활성 세션 하나만 저장하므로 새 로그인은 이전 기기의 세션을 무효화한다.

## 사용자 스키마

| 컬럼 | 역할 |
| --- | --- |
| `email` | 로그인 식별자, unique |
| `password_hash` | `salt:scryptHash` 형식의 비밀번호 해시 |
| `session_token_hash` | 활성 세션 원문의 SHA-256 해시, nullable |
| `session_expires_at` | 활성 세션 만료 시각, nullable |
| `permission_flg` | 화면 모델의 `isApproved`, 카드·드로잉 편집 권한 |
| `role` | `user` 또는 `admin`, 보드 생성·이름 변경·삭제 권한 |

세션 원문은 DB에 저장하지 않는다. `session_token_hash`와 `session_expires_at`은 같은 사용자 행에 저장되므로 계정당 동시 활성 세션은 하나다.

## 세션 유틸리티

| 함수/상수 | 동작 |
| --- | --- |
| `sessionCookieName` | `kyuboard_session` |
| `sessionMaxAgeSeconds` | 7일 |
| `createSessionToken()` | 32바이트 난수를 base64url로 인코딩해 43자 토큰 생성 |
| `hashSessionToken(token)` | SHA-256 hex 해시 생성 |
| `getSessionTokenHash(token)` | 토큰이 `[A-Za-z0-9_-]{43}` 형식일 때만 해시 반환, 아니면 `null` |
| `createSessionExpiresAt(now)` | 기준 시각에 7일을 더한 `Date` 반환 |

## 로그인

`POST /api/signin`

1. email을 trim하고 email/password 공백 여부를 검사한다.
2. email로 사용자 한 명을 조회하고 scrypt로 비밀번호를 검증한다.
3. 새 난수 토큰과 7일 만료 시각을 만든다.
4. 사용자 행의 `session_token_hash`, `session_expires_at`, `updated_at`을 갱신한다.
5. 원문 토큰을 HttpOnly 쿠키로 응답한다.

쿠키 속성은 `SameSite=Lax`, `path=/`, `maxAge=7일`이며 운영 환경에서만 `Secure`다. 사용자 행의 기존 세션 해시를 덮어쓰므로 이전 기기가 가진 쿠키는 즉시 DB 조회에 실패한다.

## 현재 사용자 조회

`GET /api/me`와 권한이 필요한 Route Handler는 `getCurrentUserFromRequest()`를 사용한다.

1. 요청 쿠키에서 토큰을 읽는다.
2. 토큰 형식이 유효하면 SHA-256 해시를 만든다.
3. `session_token_hash`가 같고 `session_expires_at > 현재 시각`인 사용자 한 명을 조회한다.
4. 일치하는 사용자가 없으면 `null`, 있으면 `id`, `email`, `isApproved`, `role`을 반환한다.

`GET /api/me`는 비로그인·만료·교체된 세션에 `{ user: null }`과 200을 반환한다. DB 오류는 상위 Route Handler의 catch로 전달되어 500 응답이 된다.

## 로그아웃

`POST /api/signout`

1. 현재 쿠키를 형식 검사하고 해시한다.
2. 유효한 해시가 있으면 같은 `session_token_hash`를 가진 사용자 행의 세션 해시와 만료 시각을 `null`로 만든다.
3. 성공 응답에서 `kyuboard_session` 쿠키를 삭제한다.

쿠키가 없거나 형식이 잘못되어도 로그아웃 응답은 성공하며 쿠키 삭제를 시도한다. 이미 다른 기기 로그인으로 세션이 교체된 경우에도 다른 활성 세션 행을 지우지 않는다.

## 가입과 비밀번호

`POST /api/signup`은 email 형식과 길이 10 이상·영문·숫자 조합의 비밀번호를 검사한다. 비밀번호는 16바이트 random salt와 scrypt 64바이트 결과를 `salt:hex`로 저장한다. 신규 사용자는 `isApproved=false`, `role=user`이며 가입 성공만으로 로그인되지는 않는다.

`verifyPassword()`는 저장 문자열을 salt와 hash로 분리하고 scrypt 결과와 저장 Buffer의 길이가 같을 때 `timingSafeEqual`로 비교한다.

## 클라이언트 상태

`useBoardAuth`가 `currentUser`, Sign-in/Sign-up 모달 상태를 소유한다.

- 마운트 시 `GET /api/me`를 호출해 `data.user ?? null`을 저장한다.
- `canEditCard`는 `currentUser?.isApproved === true`다.
- 로그인 모달 성공 콜백이 응답의 사용자 정보를 즉시 저장한다.
- 로그아웃은 응답이 성공한 경우에만 사용자를 `null`로 만들고 `onSignOutComplete`를 호출한다.

## 권한 경계

- `getCardPermissionMessage()`는 비로그인과 미승인을 구분해 카드·드로잉·AI Route Handler에서 공통 사용한다.
- 카드와 드로잉 편집, 미리보기 갱신, AI 호출은 승인된 사용자를 요구한다.
- 보드 생성·이름 변경·삭제는 별도로 `role === "admin"`을 요구한다.
- 화면의 `canEditCard`는 UX 게이트일 뿐이며 최종 권한 검사는 각 Route Handler가 다시 수행한다.

## 유지보수 기준

- 세션 기간을 바꿀 때 `sessionMaxAgeSeconds`를 기준으로 쿠키와 DB 만료 시각을 함께 유지한다.
- 토큰 원문을 로그, API JSON, DB에 남기지 않는다.
- 다중 기기 동시 접속을 허용하려면 사용자 행의 두 세션 컬럼을 재사용하지 말고 별도 세션 테이블로 전환해야 한다.
- 만료된 세션 값은 조회에서 배제되지만 자동 삭제되지는 않으며, 다음 로그인 또는 해당 세션의 로그아웃 때 교체·정리된다.

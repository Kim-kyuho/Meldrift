# SignInModal 상세설계

소스: `components/SignInModal.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `onClose` | `() => void` | 오버레이 클릭(44줄), X 버튼(54줄), Cancel 버튼(101줄), 로그인 성공 후(36줄) 총 4곳 |
| `onSignIn` | `(user: CurrentUser) => void` | 로그인 성공 시 `data.user` 전달 (35줄) |

## State

| State | 타입/초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `errorMessage` | `string`, `""` | `POST /api/signin` 실패 시 `data.message ?? "Sign-in failed."` (31줄) | 폼 내부 `<p className="text-rose-600">`로 렌더 (92~96줄) |

## 핸들러: `handleSignIn(email, password)` (17~37줄)

1. `fetch("/api/signin", { method: "POST", body: { email, password } })`
2. `data.ok === false` → `setErrorMessage(...)` 후 `return` (성공 콜백 미호출)
3. `data.ok === true` → `onSignIn(data.user)` 실행 후 **곧바로 `onClose()`도 호출** (35~36줄) — 부모가 닫지 않아도 이 컴포넌트 스스로 모달을 닫는다.

## 폼 제출 흐름 (60~70줄)

1. `event.preventDefault()`
2. `FormData`에서 `email`, `password` 추출
3. `handleSignIn(email, password)` 호출

## 렌더 구조 / z-index

| 요소 | z-index | 비고 |
| --- | --- | --- |
| 오버레이 (41줄) | 70 | 클릭 시 `onClose` |
| 모달 패널 (46줄) | 80 | `w-[min(22rem,calc(100vw-2rem))]` |
| Email input (74줄) | - | `type="email"`, `autoComplete="email"`, `required` |
| Password input (84줄) | - | `type="password"`, `autoComplete="current-password"`, `required` |
| 에러 메시지 (92줄) | - | `errorMessage`가 truthy일 때만 |
| Cancel 버튼 (98줄) | - | `type="button"`, `onClose` |
| Sign-in 제출 버튼 (105줄) | - | `type="submit"` |

## 알려진 특이사항

- `RenameBoardModal`/`CreateBoardModal`과 동일한 backdrop(70)/panel(80) z-index, 동일한 레이아웃 클래스 패턴을 공유한다.
- 로그인 성공 시 이 컴포넌트가 직접 `onClose()`까지 호출하므로, `onSignIn` 콜백 안에서 별도로 모달을 닫는 로직을 넣으면 중복 호출이 된다(멱등하지 않은 부수효과가 있다면 주의).
- fetch 자체가 실패(네트워크 오류)하는 경우에 대한 처리가 없다 — `RenameBoardModal`과 동일한 패턴의 공백.

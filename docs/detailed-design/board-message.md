# BoardMessage 상세설계

소스: `components/BoardMessage.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `message` | `string` | 각 분기에서 `{message && (...)}`로 빈 문자열이면 아무것도 렌더하지 않음 (34, 48, 62줄) |
| `type` | `"permission" \| "memo" \| "error"` | 어느 `if` 분기를 타는지 결정 (31, 45, 59줄) |
| `onDismiss` | `() => void` | 옵셔널. 자동 닫힘 타이머가 만료될 때 호출(25줄) — 호출자가 자신의 메시지 state를 빈 문자열로 되돌린다 |

## State

없음. 대신 `onDismissRef`(13줄)가 최신 `onDismiss`를 보관한다.

## 자동 닫힘 (15~29줄)

- 첫 `useEffect`(15~17줄)는 렌더마다 `onDismissRef.current`를 최신 `onDismiss`로 갱신한다.
- 두 번째 `useEffect`(19~29줄)는 `message`가 빈 문자열이면 즉시 반환하고, 값이 있으면 3500ms 타이머를 걸어 `onDismissRef.current?.()`를 호출한다.
- cleanup에서 `clearTimeout`을 호출하므로 메시지가 바뀌면 이전 타이머가 취소되고 새 메시지 기준으로 다시 3500ms를 센다.
- 두 번째 effect의 의존성은 `[message]`뿐이다. `onDismiss`가 매 렌더 새 함수로 전달되어도 타이머가 재시작하지 않도록 Ref 미러를 둔다.
- `onDismiss`를 전달하지 않으면 타이머는 그대로 돌지만 아무 것도 하지 않으므로 메시지가 계속 남는다.

## 렌더 분기 (31~69줄)

| `type` | 조건부 렌더 여부 | 컨테이너 | 스타일 | 비고 |
| --- | --- | --- | --- | --- |
| `"permission"` | `message`가 truthy일 때만 (34줄) | `div` | `fixed left-1/2 top-20 ... rounded-xl bg-white ... text-rose-600 shadow-md`, `zIndex: 60` | `"memo"`와 마크업이 완전히 동일 |
| `"memo"` | `message`가 truthy일 때만 (48줄) | `div` | `permission`과 100% 동일한 className/스타일 | 코드가 그대로 중복 |
| `"error"` | `message`가 truthy일 때만 (62줄) | `p` | `text-xs leading-5 text-rose-600` | 상단 고정이 아니라 부모 레이아웃 안 인라인 문단 |
| 그 외(타입에 매칭 안 됨) | - | - | - | 세 `if` 모두 아니면 함수가 `undefined`를 반환(암묵적) — TypeScript 유니온이라 실제로는 도달 불가 |

## 호출자

| 호출자 | `type` | `onDismiss` |
| --- | --- | --- |
| `BoardClient` (BoardClient.tsx 376, 381줄) | `permission`, `memo` | `setPermissionMessage("")`, `setMemoMessage("")` |
| `BoardList` (BoardList.tsx 108줄) | `permission` | `setBoardListMessage("")` |
| `CreateBoardModal` (CreateBoardModal.tsx 116줄) | `error` | `setErrorMessage("")` |
| `RenameBoardModal` (RenameBoardModal.tsx 83줄) | `error` | `setErrorMessage("")` |

## 알려진 특이사항

- `"permission"`과 `"memo"` 분기는 JSX가 글자 그대로 동일하다 — 두 타입을 구분하는 실질적 차이가 코드상 없고, 호출자가 의미상 다른 용도로 쓸 뿐이다. 하나로 합쳐도 동작이 바뀌지 않는다.
- 세 `if`가 `else if`가 아니라 독립된 `if`라서, 컴파일러 입장에서는 이론상 세 조건이 모두 거짓인 경로(현재 타입이 유니온이라 실질적으로는 발생 불가)가 존재한다.
- 같은 메시지 문자열을 연속으로 다시 설정하면 `message` 값이 변하지 않아 effect가 재실행되지 않는다 — 타이머가 갱신되지 않으므로 처음 표시된 시점부터 3500ms 후에 닫힌다.

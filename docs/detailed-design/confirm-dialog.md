# ConfirmDialog 상세설계

소스: `components/ConfirmDialog.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `message` | `string` | 다이얼로그 본문 텍스트 (33줄) |
| `onConfirm` | `() => void` | "Yes" 버튼 `onClick` (35줄) |
| `onCancel` | `() => void` | "No" 버튼 `onClick` (38줄) |

## State

없음.

## 렌더 구조 (11~46줄)

| 요소 | z-index | 위치 | 클릭 동작 |
| --- | --- | --- | --- |
| backdrop `div.confirm-dialog` (13줄) | 40 | `position: fixed; inset: 0` | 없음 — 클릭해도 `onCancel`/`onConfirm`이 호출되지 않는다 |
| panel `div.confirm-dialog` (22줄) | 50 | `fixed`, `left: 50vw; top: 50dvh`, `translate(-50%, -50%)`로 중앙 고정 | - |
| `<p>{message}</p>` (33줄) | - | panel 내부 | - |
| "Yes" `PressableButton` (35줄) | - | panel 내부, `variant="menu"` | `onConfirm` 호출 |
| "No" `PressableButton` (38줄) | - | panel 내부, `variant="menu"` | `onCancel` 호출 |

`createPortal(..., document.body)`로 렌더되어 호출 위치의 DOM 트리와 무관하게 항상 body 최상위에 붙는다.

## 외부에서 `.confirm-dialog` 클래스를 소비하는 지점 (컴포넌트 밖, 실제 검증됨)

- `hooks/useTableCard.ts:93, 109` — `element?.closest(".confirm-dialog")`로 눌린 지점이 다이얼로그 내부인지 판정(표 카드 바깥 클릭 시 저장/닫힘 로직에서 다이얼로그 클릭을 예외 처리).
- `hooks/useBoardScroll.ts:56` — 보드 패닝을 시작하지 않아야 하는 DOM selector 목록에 `.confirm-dialog` 포함.

## 알려진 특이사항

- backdrop을 클릭해도 닫히지 않는다 — 취소하려면 반드시 "No" 버튼을 눌러야 한다(오버레이 클릭으로 닫히는 다른 모달들, 예: `RenameBoardModal`과 동작이 다르다).

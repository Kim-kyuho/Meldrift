# ImageToolBar 상세설계

소스: `components/ImageToolBar.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `onBringToFront` | `() => void` | "Bring image to front" 버튼 `onClick` (19줄) |
| `onSendToBack` | `() => void` | "Send image to back" 버튼 `onClick` (22줄) |
| `onDelete` | `() => void` | "Delete image" 버튼 `onClick` (25줄) |

## State

없음. 자체 상태 없이 세 콜백을 버튼에 연결만 하는 프레젠테이셔널 컴포넌트.

## 핸들러

없음 — 로컬 핸들러를 정의하지 않고 props를 그대로 `onClick`에 전달한다. `onDelete`가 즉시 삭제인지 확인 다이얼로그를 여는지는 이 컴포넌트에는 정보가 없고 호출자(`ImageCard`)의 구현에 달려있다.

## 렌더 구조

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| `CardToolPortal` (18줄) | `document.getElementById("card-tool-portal")`이 존재할 때만 실제 렌더(포탈이 없으면 `CardToolPortal`이 `null` 반환) | 상세: `card-tool-portal.md` |
| `CardToolButton` "Bring image to front" (19줄) | 항상 | 아이콘 `BringToFront` |
| `CardToolButton` "Send image to back" (22줄) | 항상 | 아이콘 `SendToBack` |
| `CardToolButton` "Delete image" (25줄) | 항상 | 아이콘 `Trash2`, `className="text-rose-600"`로 시각적 경고 |

## 알려진 특이사항

- `MermaidToolBar`, `TableToolBar`와 프롭 타입·구조가 100% 동일하고 `label` 문자열(카드 종류 이름)만 다르다 — 세 컴포넌트를 `type` prop 하나로 합친 제네릭 `CardToolBar`로 대체 가능한 중복 코드.

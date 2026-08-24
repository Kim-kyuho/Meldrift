# TableToolBar 상세설계

소스: `components/TableToolBar.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `onBringToFront` | `() => void` | "Bring table to front" 버튼 `onClick` (19줄) |
| `onSendToBack` | `() => void` | "Send table to back" 버튼 `onClick` (22줄) |
| `onDelete` | `() => void` | "Delete table" 버튼 `onClick` (25줄) |

## State

없음. 자체 상태 없이 세 콜백을 버튼에 연결만 하는 프레젠테이셔널 컴포넌트.

## 핸들러

없음 — 로컬 핸들러를 정의하지 않고 props를 그대로 `onClick`에 전달한다.

## 렌더 구조

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| `CardToolPortal` (18줄) | `#card-tool-portal` DOM 노드가 있을 때만 실제 렌더 | 상세: `card-tool-portal.md` |
| `CardToolButton` "Bring table to front" (19줄) | 항상 | 아이콘 `BringToFront` |
| `CardToolButton` "Send table to back" (22줄) | 항상 | 아이콘 `SendToBack` |
| `CardToolButton` "Delete table" (25줄) | 항상 | 아이콘 `Trash2`, `className="text-rose-600"` |

## 알려진 특이사항

- `ImageToolBar`, `MermaidToolBar`와 프롭 타입·구조가 100% 동일하고 `label` 문자열만 다르다 — 중복 코드(상세: `image-tool-bar.md`).
- 표 셀 편집 UI는 이 툴바가 아니라 `TableGrid`/`TableCard` 쪽에 있다 — 이 컴포넌트는 레이어 이동/삭제만 담당.

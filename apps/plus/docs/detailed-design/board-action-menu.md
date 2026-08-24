# BoardActionMenu 상세설계

소스: `components/BoardActionMenu.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `ref` | `Ref<HTMLDivElement>`, 옵셔널 (React 19 스타일 prop-ref) | 루트 `div`에 연결 (20줄) — 호출자(`useBoardList`)가 외부 클릭 판정에 사용 |
| `onRename` | `() => void` | "Rename" 버튼 `onClick` (23줄) |
| `onDelete` | `() => void` | "Delete" 버튼 `onClick` (29줄) |

## State

없음 — 권한이나 표시 여부를 스스로 판단하지 않는다(렌더 여부는 호출자가 결정).

## 렌더 구조 (18~36줄)

| 요소 | 위치/스타일 | 비고 |
| --- | --- | --- |
| 루트 `div` (19줄) | `absolute right-2 top-11`, `z-50000`, `bg-white rounded-md shadow-md` | 부모(보드 목록 항목)를 기준으로 절대 배치 |
| "Rename" `PressableButton` (23줄) | `variant="menu"` | 아이콘 `Pencil`, 텍스트 "Rename" |
| "Delete" `PressableButton` (29줄) | `variant="menu"` | 아이콘 `Trash2`, 텍스트 "Delete", `text-rose-600`으로 강조 |

## 알려진 특이사항

- React 19의 `ref`를 일반 prop으로 받는 문법(`forwardRef` 미사용)을 쓴다 — React 19 미만에서는 동작하지 않는다(`package.json` 기준 React 19.2.4라 문제 없음).
- `z-50000`이라는 매우 큰 임의값 클래스를 쓰는데, 이 프로젝트 전역에서 `z-50000`이 여러 컴포넌트(`BoardSearchPanel`, `BoardZoomControl`, `BoardNavigator` 등)에 반복돼 사실상 "최상위 UI 레이어"를 의미하는 매직 넘버로 쓰이고 있다.

# BoardSearchPanel 상세설계

소스: `components/BoardSearchPanel.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `searchText` | `string` | `<input value={searchText}>` — 완전 제어 컴포넌트 (26줄) |
| `currentIndex` | `number` | `{currentIndex}/{searchCount}` 표시 (34줄) |
| `searchCount` | `number` | 위와 동일 (34줄) |
| `onTextChange` | `(query: string) => void` | `<input onChange>`에서 `event.target.value` 전달 (27줄) |
| `onPrev` | `() => void` | 위(`ChevronUp`) 버튼 `onClick` (37줄) |
| `onNext` | `() => void` | 아래(`ChevronDown`) 버튼 `onClick` (41줄) |

## State

없음 — 완전 제어 컴포넌트. 검색어, 현재 인덱스, 결과 계산 로직은 모두 호출자(`useBoardSearch`, `useBoardMemoFocus`)가 소유한다.

## 렌더 구조 (23~46줄)

| 요소 | 스타일/속성 | 비고 |
| --- | --- | --- |
| 루트 `div` (24줄) | `fixed bottom-20 left-1/2 -translate-x-1/2`, `z-50000`, `bg-white rounded-xl shadow-md` | 화면 하단 중앙 고정 |
| `<input>` (25줄) | `text-[16px]`, placeholder "Search memos" | 글자 크기를 16px로 고정해 iOS Safari의 입력 포커스 시 자동 확대(zoom)를 방지 |
| `<span>` (33줄) | `text-xs text-neutral-500` | `{currentIndex}/{searchCount}` — 0/0 등 값 자체의 유효성 검증은 하지 않고 그대로 표시 |
| `ChevronUp` 버튼 (37줄) | 일반 `<button>` (PressableButton 아님) | `onPrev` 호출 |
| `ChevronDown` 버튼 (41줄) | 일반 `<button>` (PressableButton 아님) | `onNext` 호출 |

## 알려진 특이사항

- 이전/다음 버튼이 이 프로젝트의 다른 아이콘 버튼들과 달리 `PressableButton`을 쓰지 않고 순수 `<button>`이다 — 터치 눌림 피드백이 다른 컨트롤들과 일관되지 않는다.
- `currentIndex`/`searchCount`가 0이거나 검색 결과가 없을 때의 표시(`0/0`)를 이 컴포넌트가 별도로 안내하지 않는다 — 빈 상태 UX는 전적으로 상위에서 넘겨주는 숫자에 의존한다.

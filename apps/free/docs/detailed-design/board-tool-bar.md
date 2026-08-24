# BoardToolBar 상세설계

소스: `components/BoardToolBar.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `cardEditing` | `boolean` | 일반 도구 목록 전체의 렌더 조건 (`!cardEditing`, 42줄) |
| `drawingMode` | `boolean` | 왼쪽 아래 버튼의 시작/완료 상태와 아이콘 결정 |
| `searchBarOpen` | `boolean` | 검색 버튼의 활성색과 `aria-pressed` 결정 |
| `boardNavigatorOpen` | `boolean` | Compass 버튼의 활성색과 `aria-pressed` 결정 |
| `boardZoom` / `setBoardZoom` | `number` / setter | `BoardZoomControl`에 그대로 전달 (144~147줄) |
| `setMenuOpen` | setter | 모든 일반 명령 버튼이 클릭 시 함께 `false` 호출 |
| `setSearchBarOpen` | setter | 검색 버튼에서 `prev => !prev`로 토글 (72줄) |
| `setBoardNavigatorOpen` | setter | Compass 버튼에서 메모 네비게이터 표시를 토글 |
| `onMemoCreateClick` | `() => void` | 메모 생성 버튼 (82줄) |
| `onImageUploadClick` | `() => void` | 이미지 버튼 (94줄) |
| `onMermaidCreateClick` | `() => void` | Mermaid 버튼 (118줄) |
| `onTableCreateClick` | `() => void` | 표 버튼 (106줄) |
| `onDrawingToggleClick` | `() => void` | 드로잉 버튼 (130줄) |

## State

없음. 로컬 상수 `toolbarButtonClassName`/`toolbarIconClassName`은 오른쪽 일반 도구 버튼의 40x40 크기와 아이콘 스타일을 공유한다. 드로잉 시작/완료 버튼은 왼쪽 아래에 분리된 48x48 원형 버튼이다.

## 버튼 목록과 클릭 시 부수효과 (40~139줄)

| 순서 | 아이콘 | 콜백 | 클릭 시 함께 실행 |
| --- | --- | --- | --- |
| 1 | `Compass` | `setBoardNavigatorOpen(prev => !prev)` | 검색 패널과 보드 메뉴 닫기 |
| 2 | `Search` | `setSearchBarOpen(prev => !prev)` | 메모 네비게이터와 보드 메뉴 닫기 |
| 3 | `SquarePen` | `onMemoCreateClick` | `setMenuOpen(false)` |
| 4 | `Camera` | `onImageUploadClick` | `setMenuOpen(false)` |
| 5 | `Table2` | `onTableCreateClick` | `setMenuOpen(false)` |
| 6 | `Workflow` | `onMermaidCreateClick` | `setMenuOpen(false)` |
| 별도 | `Pencil` / `Check` | `onDrawingToggleClick` | 검색 패널·메모 네비게이터·보드 메뉴를 닫고 드로잉 모드 전환 |

모든 버튼이 예외 없이 `setMenuOpen(false)`를 호출한다 — `BoardMenu` 드롭다운이 열려있는 상태에서 어떤 보드 도구를 눌러도 그 메뉴가 자동으로 닫힌다.

## 렌더 구조 (40~150줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| 일반 도구 세로 목록 `div` (43줄) | `!cardEditing`일 때만 | `fixed bottom-16 right-5`, `z-50000`, class `board-toolbar toolbar-reveal` |
| 드로잉 시작/완료 버튼 | `!cardEditing || drawingMode` | `fixed bottom-10 left-10`, 같은 위치에서 `Pencil`과 `Check` 전환 |
| `#card-tool-portal` `div` (141줄) | **항상**, `cardEditing` 값과 무관 | 빈 컨테이너 — `CardToolPortal`(각 카드 툴바, `DrawingToolBar`)이 `createPortal`로 여기에 자식을 렌더링하는 대상. 동일 위치(`fixed bottom-16 right-5`, `z-50000`)에 겹쳐 배치되어, 카드 편집 중에는 일반 도구 대신 이 슬롯에 카드 전용 툴바가 나타나는 것처럼 보인다 |
| `BoardZoomControl` (144줄) | 항상 | `cardEditing`과 무관하게 항상 표시 |

## 알려진 특이사항

- `#card-tool-portal`이 일반 도구 목록과 정확히 같은 좌표(`bottom-16 right-5`)에 위치하는 것은 우연이 아니라 의도된 설계로 보인다 — 카드 편집 진입 시 "일반 도구 숨김 + 같은 자리에 카드 도구 등장"으로 자리를 교대하는 방식.
- `board-toolbar` 클래스는 `hooks/useBoardScroll.ts`의 패닝 제외 목록과 `useTableCard`/유사 훅들의 "빈 보드 클릭 판정" 제외 목록에도 쓰인다 — 이 툴바 위에서는 보드 드래그 패닝이나 카드 바깥 클릭 저장이 발생하지 않는다.

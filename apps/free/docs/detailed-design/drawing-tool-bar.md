# DrawingToolBar 상세설계

소스: `components/DrawingToolBar.tsx`, `hooks/useBoardDrawing.ts`, `lib/board-stroke.ts`

## DrawingToolBar Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `drawingTool` | `DrawingTool` | 지우개 버튼의 `aria-pressed`·아이콘 색 |
| `penColor` | `string` | Palette 아이콘 색(69줄) |
| `penWidth` | `number` | 굵기 아이콘의 `strokeWidth`(90줄) |
| `onChangeColor` | `(color: string) => void` | 색상 선택 시(48줄) |
| `onChangeWidth` | `(width: number) => void` | 굵기 선택 시(53줄) |
| `onToggleErase` | `() => void` | Erase 버튼 클릭(112줄) |
| `onUndo` | `() => void` | Undo 버튼 클릭(64줄) |

## State (34~35줄)

| State | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `openColorMenu` | `false` | `toggleColorMenu`(37~40줄), 색상 선택 후 `handleColorSelect`가 `false`로(49줄) | 색상 팔레트 팝업 렌더 조건(71줄) |
| `openWidthMenu` | `false` | `toggleWidthMenu`(42~45줄), 굵기 선택 후 `handleWidthSelect`가 `false`로(54줄) | 굵기 팝업 렌더 조건(92줄) |

두 메뉴는 상호 배타적이다 — 하나를 열면(`toggleColorMenu`/`toggleWidthMenu`) 다른 하나를 항상 `false`로 닫는다(38~39, 43~44줄).

## 핸들러

| 함수 | 동작 |
| --- | --- |
| `toggleColorMenu` | `openColorMenu` 토글 + `openWidthMenu` 강제 닫기 |
| `toggleWidthMenu` | `openWidthMenu` 토글 + `openColorMenu` 강제 닫기 |
| `handleColorSelect(color)` | `onChangeColor(color)` 호출 후 메뉴 닫기 |
| `handleWidthSelect(width)` | `onChangeWidth(width)` 호출 후 메뉴 닫기 |
| `closeMenus()` | 두 메뉴 모두 닫기 — Erase 버튼 클릭 시 먼저 호출 |

## 렌더 구조 (62~134줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| Undo (64줄) | 항상 | 클릭 즉시 `onUndo()`, 활성/비활성 조건 없음(스택이 비어도 버튼은 항상 눌림 가능 — 실제 무동작 처리는 `useBoardDrawing.handleUndoStroke`가 담당) |
| Pen color (68줄) | 항상 | 팔레트 아이콘 색을 `penColor`로 동적 지정 |
| 색상 팝업 (71줄) | `openColorMenu`일 때만 | `lib/board-stroke.ts`의 `penColors`(7색: Ink/Red/Yellow/Green/Sky/Blue/Purple) 순회, 원형 스와치 버튼 |
| Pen width (89줄) | 항상 | `Minus` 아이콘의 `strokeWidth`로 현재 굵기 시각화 |
| 굵기 팝업 (92줄) | `openWidthMenu`일 때만 | `penWidths`(Thin 2 / Medium 4 / Bold 8) 순회 |
| Erase (107줄) | 항상, `aria-pressed={drawingTool==="erase"}` | 라벨이 상태에 따라 "Erase" ↔ "Stop erasing"으로 바뀜, 활성 시 아이콘이 `#ec4899`(activeToolColor) |

## 도구 상태 소유자: `useBoardDrawing` (`hooks/useBoardDrawing.ts`)

이 컴포넌트 자신은 `drawingTool`/`penColor`/`penWidth`를 소유하지 않는다 — 실제 소유자는 부모가 사용하는 `useBoardDrawing`이다.

| State | 초기값 | 비고 |
| --- | --- | --- |
| `strokes` | `initialStrokes` | 확정된 획 배열 |
| `drawingMode` | `false` | 그리기 레이어 입력 활성 여부 |
| `drawingTool` | `"draw"` | `"draw" \| "erase"` |
| `penColor` | `defaultPenColor` ("Ink" `#1f2937`) | - |
| `penWidth` | `defaultPenWidth` (Medium, 4) | - |

### `handleToggleDrawingMode` (50~70줄)
- 이미 그리기 모드 → 모드 종료 + `drawingTool`을 `"draw"`로 리셋
- 아니면 → 모드 진입 + 도구를 `"draw"`로 리셋

### `handleToggleEraseTool`
지우개를 다시 누르면 `"draw"`로 되돌아가는 토글 방식이다.

### `handleStrokeEnd`/`handleErase`/`handleUndoStroke` (76~112줄)
셋 다 React의 `strokes` 상태를 직접 갱신한다. `handleErase`는 실제로 지워진 게 없으면 `eraseStrokesAlongPath`가 기존 배열 참조를 그대로 반환한다.

## 알려진 특이사항

- 그리기 중에는 Export와 SQLite autosave가 잠긴다. `BoardToolBar` 왼쪽 아래의 `Check` 버튼으로 모드를 종료하면 `BoardClient`의 snapshot autosave가 브라우저 SQLite에 획을 저장한다.
- 별도 Pan 도구는 없다. 보드를 이동하려면 필기 모드를 끝낸 뒤 기본 보드 패닝을 사용한다.
- Undo 버튼은 항상 클릭 가능하게 렌더되며(disabled 처리 없음) 빈 스택에서는 `handleUndoStroke`가 조용히 아무 것도 하지 않는다 — 사용자에게 "더 이상 undo할 게 없다"는 피드백이 없다.

# DrawingToolBar 상세설계

소스: `packages/ui/src/features/drawing/DrawingToolBar.tsx`, `useBoardDrawing.ts`

## 도구와 상태

부모의 `useBoardDrawing`이 그리기 모드, 펜 색상·굵기, 지우개와 확정된 획 배열을 관리한다. 툴바는 색상·굵기 팝업의 열림 상태만 소유한다. 두 팝업은 동시에 열리지 않으며 선택 후 닫힌다.

| Prop | 역할 |
| --- | --- |
| `drawingTool` | `draw` / `erase`, 지우개 버튼의 선택 표시 |
| `penColor`, `penWidth` | 현재 펜 표시 |
| `onChangeColor`, `onChangeWidth` | 도구 설정 변경 |
| `onToggleErase` | 지우개와 펜 전환 |
| `onUndo` | 공통 보드 Undo 실행 |
| `undoDisabled` | 이력이 없거나 현재 실행할 수 없을 때 Undo 비활성화 |

색상·굵기 선택지는 `packages/core/src/board-stroke.ts`에 있다. 지우개를 다시 누르면 펜으로 돌아간다. 보드 패닝은 보드 모드 전환에서 처리하며 드로윙 툴바의 별도 도구로 두지 않는다.

## 공통 Undo

기존 드로윙 툴바 Undo는 더 이상 마지막 획만 지우는 별도 이력을 실행하지 않는다. 하단 중앙 Undo 버튼과 같은 `useBoardHistory`의 실행 함수를 받는다. 접근성 이름은 `Undo board change`이며 실행 제한도 공통이다.

따라서 가장 최근 작업이 지우개면 한 번의 지우개 조작을, 카드 변경이면 그 카드 작업을 되돌린다. 훅에 남은 `handleUndoStroke`는 현재 보드 UI의 Undo 버튼에 연결하지 않는다.

## 입력 완료와 저장

`DrawingLayer`의 `onInteractionChange`가 한 획 또는 한 번의 지우개 조작 시작·종료를 알린다. 조작 중의 중간 배열은 이력으로 기록하지 않고 종료 상태를 한 작업으로 기록한다.

이력 기록과 영속 저장은 별개다. 현재 `BoardClient`는 그리기 모드 동안 `savePaused`를 유지하며, 모드를 종료한 뒤 로컬 저장과 Plus 동기화를 재개한다. 그리기 모드 중 새로고침하면 아직 영속 저장되지 않은 변경은 남지 않는다.

모드 종료 알림용 내부 플래그는 `changedRef`다. `useBoardDrawing`은 서버 API나 DB를 직접 호출하지 않는다.

관련 설계: [DrawingLayer](./drawing-layer.md), [보드 이력](./board-history.md), [단축키](./board-shortcuts.md).

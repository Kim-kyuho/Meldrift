# 드로잉 상세설계 (Free)

소스: `components/BoardClient.tsx`

드로잉은 거의 전부 공유한다. 획 데이터와 지우개 판정은 `packages/core/src/board-stroke.ts`, 레이어는 [DrawingLayer](../shared/drawing-layer.md), 포인터 처리는 `packages/ui/src/hooks/useDrawingPointer.ts`, 도구 막대는 `packages/ui/src/components/DrawingToolBar.tsx`, 훅 본체는 `packages/ui/src/hooks/useBoardDrawing.ts`다.

Free가 다른 것은 **저장 경로 하나**다.

## Plus와 갈리는 지점

| | Plus | Free |
| --- | --- | --- |
| 훅 입력 | `canEditCard`, `showPermissionMessage`, `onDrawingModeEnd` | `initialStrokes` 하나 |
| 저장 | `onDrawingModeEnd`에서 `PATCH /api/drawings/[boardId]` | 넘기지 않는다 |
| 권한 | 편집 권한 검사 | 없다 (`canEditCard` 기본 `true`) |

`useBoardDrawing`은 획이 바뀌었는지까지 추적하고, 드로잉 모드를 끌 때 바뀐 게 있으면 `onDrawingModeEnd`를 부른다. **무엇을 저장할지는 앱이 정한다** — `boardId`와 `fetch`는 패키지로 들어가지 않는다. Plus는 `apps/plus/hooks/useBoardDrawing.ts`가 그 콜백에 저장을 붙이는 얇은 래퍼다.

Free는 그 콜백을 넘기지 않는다. 획이 `BoardClient`의 `snapshot.strokes`에 실려 브라우저 SQLite 자동 저장에 함께 들어간다. 다만 **드로잉 모드 중에는 자동 저장이 멈추므로 모드를 끈 뒤에 저장된다.**

# 드로잉 상세설계 (Free)

소스: `components/DrawingLayer.tsx`, `hooks/useBoardDrawing.ts`

획 데이터 구조와 지우개 판정은 `@meldrift/core/board-stroke`, 포인터 처리는 `packages/ui/src/hooks/useDrawingPointer.ts`, 도구 막대는 `packages/ui/src/components/DrawingToolBar.tsx`로 두 Edition이 공유한다. 아래는 Free만 다른 부분이다.

## Plus와 갈리는 지점

| | Plus | Free |
| --- | --- | --- |
| 저장 | 획이 끝날 때마다 `PATCH /api/drawings/[boardId]` | 저장 호출이 없다. 스냅샷 자동 저장에 실린다 |
| 훅 입력 | `boardId`, `canEditCard`, `showPermissionMessage`, `setPermissionMessage`, `onPreviewUpdate` | `initialStrokes` 하나 |
| 미저장 표시 | `unsavedRef`로 추적 | 없다 |
| 권한 | 편집 권한 검사 | 없다 |
| 루트 요소 | `<svg>`가 직접 포인터를 받는다 | `<div>` 오버레이가 감싼다 |

## `useBoardDrawing`

입력은 `initialStrokes`뿐이다. 상태는 `strokes`, `drawingMode`, `drawingTool`, `penColor`, `penWidth` 다섯이다.

| 핸들러 | 동작 |
| --- | --- |
| `handleToggleDrawingMode` | 켜고 끌 때 모두 도구를 `draw`로 되돌린다 |
| `handleToggleEraseTool` | `erase` ↔ `draw` 토글 |
| `handleStrokeEnd(points)` | 점이 2개 미만이면 버린다. 아니면 `createStrokeId()`로 획을 추가한다 |
| `handleErase(start, end, radius)` | `eraseStrokesAlongPath`로 걸친 획을 지운다 |
| `handleUndoStroke` | 마지막 획 하나를 제거한다. 비어 있으면 아무 일도 안 한다 |

되돌리기는 배열 끝을 자르는 것이 전부다. 지운 획을 되살리는 기록은 없다.

획은 `BoardClient`의 `snapshot.strokes`로 들어가 자동 저장에 함께 실린다. 드로잉 모드 중에는 자동 저장이 멈추므로, **모드를 끈 뒤에 저장된다.**

## 포인터 오버레이

Free의 `DrawingLayer`는 `<svg>`를 `<div>`로 한 겹 감싸고, 그 `div`에서 포인터 이벤트 네 종류를 `stopPropagation`한다.

```text
div  onPointerDown/Move/Up/Cancel → stopPropagation만
 └ svg  onPointerDown/Move/Up/Cancel/Leave → 실제 그리기 핸들러
```

일부 모바일 브라우저에서 SVG의 `touch-action`이 안정적으로 적용되지 않아, 그리는 중에 보드 패닝이 같이 일어나는 문제가 있었다. HTML 오버레이가 먼저 전파를 끊어 이를 막는다.

Plus는 `<svg>`가 곧 루트이고 이 오버레이가 없다.

## 렌더 내용

`StrokePaths`로 저장된 획을, 그리는 중이면 `strokeToPath(currentPoints)`로 현재 획을 함께 그린다. 지우개 도구일 때는 커서 위치에 반지름 `eraserRadius`의 흰 원을 그리고 테두리 두께를 `1 / zoom`으로 잡아 확대해도 같은 굵기로 보이게 한다.

z-index는 `ACTIVE_CARD_Z - 1`이다. 카드보다 한 단계 아래다.

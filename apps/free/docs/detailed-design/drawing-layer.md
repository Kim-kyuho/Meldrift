# DrawingLayer 상세설계

소스: `components/DrawingLayer.tsx`, `hooks/useDrawingPointer.ts`, `lib/board-stroke.ts`

## DrawingLayer Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `strokes` | `BoardStroke[]` | `StrokePaths`로 렌더 (84, 109줄) |
| `drawingMode` | `boolean` | `!drawingMode`면 입력 비활성 SVG(70~87줄), true면 입력 활성 SVG(89~131줄) |
| `drawingTool` | `DrawingTool` (`"draw" \| "erase"`) | `useDrawingPointer`에 전달, 지우개 커서 렌더 조건 |
| `penColor` / `penWidth` | `string` / `number` | 작성 중 획 path의 `stroke`/`strokeWidth` (113~114줄) |
| `zoom` | `number` | `eraserRadius` 보정(52줄), `useDrawingPointer`에 전달, 지우개 원 `strokeWidth={1/zoom}`(127줄) |
| `onStrokeEnd` | `(points: StrokePoint[]) => void` | `useDrawingPointer`가 획 완료 시 호출 |
| `onErase` | `(start, end, radius) => void` | `useDrawingPointer`가 지우개 이동마다 호출 |

## State/Ref (`useDrawingPointer`, 13~175줄)

| 이름 | 종류 | 초기값 | 용도 |
| --- | --- | --- | --- |
| `layerRef` | ref | `null` | SVG DOM 참조 — `getBoundingClientRect()`로 화면 좌표를 보드 좌표로 변환(30~40줄) |
| `activePointerRef` | ref | `null` | 현재 입력을 "소유"한 `pointerId` — 멀티터치 중 첫 입력만 인정 |
| `activePointerTypeRef` | ref | `null` | `"pen" \| "touch" \| "mouse"` — 팜 리젝션 판정에 사용 |
| `penContactRef` | ref | `false` | 펜이 화면에 닿아있는 동안 `true` — 이 동안 다른 입력 종류를 차단 |
| `currentPointsRef` | ref | `[]` | 그리는 중인 획의 최신 점 배열(리렌더 없이 최신값 유지) |
| `previousEraserPointRef` | ref | `null` | 직전 지우개 위치 — 연속 구간을 `onErase(prev, current, radius)`로 전달하기 위함 |
| `currentPoints` | state | `[]` | 화면 렌더용(작성 중 획 path) |
| `eraserPoint` | state | `null` | 지우개 커서 원 위치 |

## 팜 리젝션 / 포인터 소유권 로직

### `handlePointerDown` (65~99줄)
1. `pointerType === "pen"` → `penContactRef = true`로 켬. 그 외 타입인데 `penContactRef`가 이미 true거나, "보조 터치"(`touch`이면서 `!isPrimary`)면 무시하고 종료 — **펜 접촉 중에는 손가락 입력을 완전히 차단**
2. 이미 다른 포인터가 활성 상태(`activePointerRef !== null`)면: 새 입력이 펜이고 기존 입력이 펜이 아니었다면 `discardCurrentInput()`(기존 획 폐기), 아니면 `finishCurrentStroke()`(기존 획 확정)
3. `drawingTool === "erase"`면 이 시점부터 즉시 `onErase(point, point, radius)` 1회 호출, 아니면 새 획의 첫 점 기록

### `handlePointerMove` (101~144줄)
- "펜 접촉 중인데 이 이벤트가 펜이 아님"이면 무시
- `pressed = event.buttons !== 0 || (pen && pressure > 0)` — 펜은 압력값으로도 눌림 판정
- 펜인데 `pressed`가 false면 `penContactRef = false`(호버로 전환, 접촉 해제)
- erase 모드: 소유 포인터가 눌림 해제되면 소유권 반납, 눌린 채면 `onErase(previousPoint, boardPoint, radius)` 호출 후 `previousEraserPointRef` 갱신
- draw 모드: 소유 포인터가 아니면 무시, 눌림 해제되면 `finishCurrentStroke()`, 그 외엔 점 추가

### `handlePointerUp` / `handlePointerCancel` (146~163, DrawingLayer.tsx 106줄에서 cancel도 동일 핸들러 연결)
- 펜이면 `penContactRef = false`
- 소유 포인터가 아니면 무시
- erase면 소유권만 반납(획 확정 로직 없음), draw면 `finishCurrentStroke()`

### `finishCurrentStroke` (43~54줄)
- 점이 2개 초과(엄밀히는 `> 1`)일 때만 `onStrokeEnd(points)` 호출 — 단일 클릭(점 1개)은 획으로 저장되지 않음

## `toBoardPoint` 좌표 변환 (30~41줄)

```
x = (event.clientX - layerRect.left) / zoom
y = (event.clientY - layerRect.top) / zoom
```
`layerRef.current`가 없으면(레이아웃 계산 전 등) `[0, 0]`을 반환 — 이 경우 잘못된 위치에 점이 찍힐 수 있음.

## DrawingLayer 렌더 분기 (42~132줄)

| 상태 | SVG 속성 | 내용 |
| --- | --- | --- |
| `drawingMode === false` (70~87줄) | `pointerEvents: "none"`, `aria-hidden` | `StrokePaths`만 렌더(과거 획 표시 전용) |
| `drawingMode === true` (89~131줄) | `pointerEvents: "auto"`, `touchAction: "none"`, `cursor: "crosshair"` | `StrokePaths` + 작성 중 획(`currentPoints.length > 0`일 때) + 지우개 원(`drawingTool === "erase" && eraserPoint`일 때) |

z-index는 두 경우 모두 `ACTIVE_CARD_Z - 1`(카드보다 한 단계 아래).

## `strokeToPath` 곡선 알고리즘 (`lib/board-stroke.ts` 130~159줄)

- 점 0개 → `""`
- 점 1개 → `M x y` (점만)
- 점 2개 → `M x y L x y` (직선)
- 점 3개 이상 → 시작점에서 `M`, 중간 각 점을 quadratic curve의 **control point**로 쓰고 그 점과 다음 점의 중점을 **end point**로 사용(`Q cx cy midX midY` 반복) → 마지막 점까지 `L`로 마감. 이 방식은 각 원본 점을 정확히 지나지 않고 부드럽게 스무딩된 곡선을 만든다(Catmull-Rom 유사 기법).

## 지우개 알고리즘 (`eraseStrokesAlongPath`, 66~122줄)

1. 지우개는 `start`→`end` 선분으로 취급(포인터다운 순간엔 `start === end`인 점(원) 지우개)
2. 각 획의 각 점에 대해 `getDistanceToSegmentSquared`로 선분까지의 최단거리 제곱을 계산, `effectiveRadius = radius + stroke.width/2`(굵은 획일수록 더 쉽게 지워짐) 이내면 그 점을 "삭제"
3. 삭제되지 않고 연속된 점들을 "run"으로 묶어 각각 별도 획으로 분리(가운데가 지워지면 획이 두 개로 쪼개짐) — 첫 run만 원래 `stroke.id` 유지, 이후 run은 `createStrokeId()`로 새 id 부여
4. run의 점이 2개 미만이면 버림(최소 2점 미만인 획은 존재할 수 없다는 스키마 제약과 일치)
5. 아무것도 안 지워졌으면 원본 배열을 그대로 반환(참조 동일성 유지 → `useBoardDrawing.handleErase`가 `nextStrokes !== prev`로 변경 여부 판정, 98줄)

## 알려진 특이사항

- `activePointerRef`가 `null`이 되는 경로가 여러 곳(finish/discard/erase-up)에 흩어져 있어, 포인터 소유권 상태 전이가 한눈에 보이지 않는다 — 새 입력 종류를 추가할 때 이 흐름 전체를 다시 추적해야 한다.
- `layerRect`를 찾지 못하면 `[0,0]`으로 폴백하는데, 이 경우 사용자 입장에서는 원점에 점이 찍히는 것처럼 보일 수 있다(에러 표시 없음).
- 필기 모드에서는 레이어가 항상 포인터를 점유한다. 기본 보드 패닝을 사용하려면 필기 모드를 끝내야 한다.

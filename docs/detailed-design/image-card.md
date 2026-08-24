# ImageCard 상세설계

소스: `components/ImageCard.tsx`, `hooks/useImageCard.ts`, `hooks/useBoardImages.ts`

## ImageCard Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `image` | `ImageCardData` | `useImageCard`에 전달, `Rnd default/position/size` 초기값 |
| `zoom` | `number` | `Rnd scale` |
| `canEdit` | `boolean` | `editImage`의 권한 체크 |
| `isEditing` | `boolean` | `Rnd disableDragging={!isEditing}`/`enableResizing={isEditing}`, 툴바 노출 |
| `onEditing` / `onEditingClear` / `onPermissionDenied` | `() => void` | 카드/삭제 편집 흐름 콜백 |
| `onInsert` | `(tempId, file, boardId, x, y, z, width, height) => void` | `saveImageDraft`가 `image.imageId < 0`(임시 카드)일 때 |
| `onUpdate` | `(imageId, boardId, publicId, secureUrl, fileName, x, y, z, width, height) => void` | `saveImageDraft`가 기존 이미지일 때 |
| `onDelete` | `(imageId, publicId) => void` | `confirmDelete`에서 |
| `onBringToFront` / `onSendToBack` | `() => void` | `ImageToolBar`로 전달 |

## `useImageCard` State (71~230줄)

| State/Ref | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `imageState` | `{x,y,width,height} = image.*` | `handleDragStop`, `handleResizeStop` | `Rnd position/size` |
| `deleteDialogOpen` | `false` | `openDeleteDialog`(true)/`confirmDelete`·`closeDeleteDialog`(false) | `ConfirmDialog` 렌더 조건 |
| `imageStateRef` | `imageState` 미러 | 매 `handleDragStop`/`handleResizeStop`에서 즉시 동기화(useEffect 아님 — 핸들러 안에서 직접 대입, 189, 200줄) | `saveImageDraft`가 최신 좌표를 읽기 위해 사용 |
| `lastImageTapRef` | `0` | `handleDoubleTap`마다 갱신 | 300ms 더블탭 판정 |

## `saveImageDraft()` (82~127줄)

1. `image.imageId < 0`(임시 카드)이고 `image.file`이 없으면 아무 것도 안 하고 종료(방어 코드 — 정상 흐름에서는 임시 카드에 항상 `file`이 있음)
2. `image.imageId < 0`이면 `onInsert(imageId, file, boardId, round(x), round(y), z, round(width), round(height))` — **z는 반올림하지 않고 그대로 전달**(x/y/width/height만 `Math.round`)
3. 기존 이미지면 `onUpdate(...)`도 동일하게 z는 원본 그대로, 나머지는 반올림

## 저장 트리거: 빈 보드 pointerup (153~181줄)

- `TableCard`/`useTableCard`와 달리 **pointerdown 시작 지점을 별도로 기록하지 않는다** — `pointerup` 한 번만으로 판정.
- 클릭 대상이 `.board-scroll-layer` 안이면서 `.image-rnd-{imageId}`와 `.board-toolbar` 어디에도 속하지 않으면 "빈 보드 클릭"으로 간주.
- `isEditing`이고 빈 보드 클릭이면 `window.setTimeout(() => { saveImageDraft(); onEditingClear(); }, 0)` — **0ms 지연을 둬서 다음 이벤트 루프 틱으로 저장을 미룬다**(같은 틱에서 발생하는 다른 이벤트 핸들러와의 순서 충돌 방지 목적으로 추정, 다른 카드 훅에는 없는 이 카드만의 패턴).

## 기타 핸들러

| 핸들러 | 동작 |
| --- | --- |
| `editImage()` (129~136줄) | `canEdit` false → `onPermissionDenied()`, true → `onEditing()` |
| `handleDoubleTap` (138~151줄) | 터치이고 300ms 이내 재탭이면 `editImage()`. `event.preventDefault()` 호출부는 주석 처리되어 있음(148줄, 죽은 코드) |
| `handleImagePress` (183~185줄) | `stopPropagation()`만 수행 |
| `handleDragStop`/`handleResizeStop` (187~202줄) | `TableCard`와 동일 패턴으로 `imageState`/`imageStateRef` 갱신 |
| `confirmDelete` (208~212줄) | `onDelete(imageId, publicId)` → `setDeleteDialogOpen(false)` → `onEditingClear()` (다른 카드들과 호출 순서가 다름 — `TableCard.confirmDelete`는 `onEditingClear`가 먼저) |

## ImageCard 렌더 구조 (88~158줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| `Rnd` (90줄) | 항상 | `className="image-rnd-{imageId} ..."`, 터치 콜아웃/선택 비활성 인라인 스타일, `bounds="parent"`, `disableDragging={!isEditing}`(권한 체크 없음 — `canEdit`은 `editImage` 진입 시점에만 확인), `default`와 `position`을 모두 지정(초기 언마운트 대비 `default` + 제어값 `position` 병행), `minWidth`/`minHeight`는 48(115~116줄) |
| 내부 wrapper (122줄) | 항상 | `onClick`(stopPropagation), `onDoubleClick={editImage}`, `onPointerDown={handleDoubleTap}` |
| `next/image` (129줄) | 항상 | `fill`, `object-contain`, `draggable={false}`, `sizes={round(width)+"px"}`, `alt={fileName ?? "Uploaded image"}` |
| `ImageToolBar` (142줄) | `isEditing`일 때만 | `onDelete={openDeleteDialog}` |
| `ConfirmDialog` (149줄) | `deleteDialogOpen`일 때만 | 메시지 "Delete this image?" |

## 생성 파이프라인 (`useBoardImages.ts`)

### `compressImage(file)` (32~93줄)
1. `Image`로 로드해 원본 크기 파악
2. 긴 변이 2000px를 넘으면 `maxSize/max(width,height)` 비율로 축소 스케일 계산(1을 넘지 않음, 즉 확대는 안 함)
3. `<canvas>`에 그려 PNG Blob 생성
4. **Blob이 4MiB(`4*1024*1024`)를 넘으면 가로·세로를 85%씩 곱해 재시도**하는 `do...while` 루프(76~80줄) — 4MiB 이하가 될 때까지 반복 축소
5. 성공 시 원본 파일명의 확장자를 `.png`로 바꾼 새 `File` 반환
6. 압축 과정에서 예외 발생 시(`catch`, 89~92줄) 콘솔에 에러만 남기고 **원본 파일을 그대로 반환**(업로드 자체는 막지 않음)

### `getImageDisplaySize(file)` (116~143줄)
압축된 파일을 다시 `<img>`로 읽어 `naturalWidth/Height` 기준 최대 400x300 비율로 축소한 **표시용** 크기 계산(로드 실패 시 기본값 400x300).

### `getImageAutoLocation()` (145~155줄)
`cardLocationRef`(보드 스크롤 컨테이너)의 현재 스크롤 위치 + 뷰포트 절반에서 카드 절반 크기(200, 150)를 뺀 좌표 — **현재 화면에 보이는 영역 중앙**에 새 이미지를 배치한다. `boardZoom`으로 나눠 보드 좌표계로 환산.

### `handleUploadImage(event)` (157~188줄)
1. `event.target.value = ""`로 같은 파일 재선택도 `onChange`가 다시 발생하도록 초기화
2. 권한 체크(`canEditCard`)
3. `compressImage` → `getImageAutoLocation` → `getImageDisplaySize` 순서로 실행
4. `imageId: -Date.now()`인 임시 카드 생성, `secureUrl`은 `URL.createObjectURL`(Object URL), `publicId: ""`
5. `images` 배열에 추가하고 `editingImageId`를 그 임시 id로 설정 → **업로드 즉시 편집 모드로 진입**

### `handleInsertImage` (190~222줄)
`FormData`로 `multipart/form-data` POST(`/api/images`) → 성공 시 임시 카드의 Object URL을 `revokeObjectURL`로 해제하고 서버가 반환한 실제 `image` 객체로 교체, `editingImageId`를 새 id로 갱신(계속 편집 상태 유지)한 뒤 `onPreviewUpdate()`를 호출한다.

### `handleUpdateImage`
PATCH 성공 시 로컬 카드의 메타데이터·좌표·크기를 교체하고 `onPreviewUpdate()`를 호출한다.

### `handleDeleteImage` (246~270줄)
- `imageId < 0`(미저장 임시 카드): Object URL 해제 + 로컬 배열에서 제거, API 호출 없음
- 저장된 이미지: `DELETE /api/images/{id}` → 성공 시 로컬 제거

삭제와 레이어 변경은 현재 보드 미리보기 갱신을 예약하지 않는다.

## 알려진 특이사항

- 이미지 저장 트리거만 `setTimeout(..., 0)`을 쓰고 다른 카드 타입(Table, Memo 등)은 동기적으로 처리한다 — 왜 이미지만 지연이 필요한지에 대한 근거가 코드/주석에 없다.
- `handleDoubleTap`의 `event.preventDefault()`가 주석 처리되어 있어(148줄), 터치 더블탭 시 브라우저 기본 동작(예: 확대/텍스트 선택)이 억제되지 않을 수 있다.
- `saveImageDraft`가 `z`값은 반올림하지 않는데, `x/y/width/height`는 반올림한다 — 다른 값들과의 일관성이 없다(다만 `z`는 정수 레이어 값이라 원본이 이미 정수일 가능성이 높다).

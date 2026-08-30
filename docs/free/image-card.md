# ImageCard 상세설계 (Free)

소스: `components/ImageCard.tsx`, `hooks/useImageCard.ts`, `hooks/useBoardImages.ts`

## Plus와 갈리는 지점

이미지 카드는 두 Edition이 공유하지 않는 유일한 카드다. Plus는 Cloudinary에 올린 `secureUrl`을 참조하지만 Free는 압축한 바이트를 SQLite BLOB에 넣는다. 저장이 다르니 카드가 받는 데이터와 콜백이 다르다.

| | Plus | Free |
| --- | --- | --- |
| 데이터 | `publicId`, `secureUrl`, `fileName` | `data: Uint8Array \| null`, `mimeType`, `url`, `label` |
| 표시 | `next/image` | 원시 `<img>` + object URL |
| 삽입 | `onInsert(tempId, file, ...)`로 업로드 | 압축 결과를 그대로 스냅샷에 넣는다 |
| 권한 | `canEdit`, `onPermissionDenied` | 없다 |

툴바(`ImageToolBar`)와 확인 대화상자(`ConfirmDialog`)는 `@meldrift/ui`에서 공유한다.

## ImageCard Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `image` | `ImageCardData` | `useImageCard`에 전달, `Rnd` 초기값 |
| `zoom` | `number` | `Rnd scale` |
| `isEditing` | `boolean` | `Rnd disableDragging/enableResizing`, 툴바 노출 |
| `onEditing`/`onEditingClear` | `() => void` | 편집 흐름 콜백 |
| `onUpdate` | `(imageId, boardId, x, y, z, width, height) => void` | 좌표·크기 저장 |
| `onDelete` | `(imageId) => void` | 삭제 |
| `onBringToFront`/`onSendToBack` | `() => void` | 레이어 변경 |

`onUpdate`에 이미지 내용 인자가 없다. Free의 이미지 카드는 만든 뒤 바이트가 바뀌지 않는다.

## 표시 방식

`image.data`가 있으면 `src` 속성을 비워 두고 effect가 object URL을 직접 넣는다.

```text
useEffect: data와 mimeType이 있으면
  URL.createObjectURL(imageBytesToBlob(data, mimeType)) → imageElement.src
  cleanup에서 revokeObjectURL
deps: [image.data, image.mimeType]
```

`data`가 없으면 `src={image.url}`로 구버전 URL을 그대로 쓴다. 둘 다 없으면 `<img>` 자체를 렌더링하지 않는다.

Next의 이미지 최적화를 쓸 수 없어 원시 `<img>`를 쓴다. blob URL과 임의 외부 URL은 최적화 대상이 아니다.

## `useImageCard` State

| 값 | 초기값 | 갱신 | 쓰임 |
| --- | --- | --- | --- |
| `imageState` | `image`의 x·y·width·height | `handleDragStop`/`handleResizeStop` | `Rnd position`/`size` |
| `deleteDialogOpen` | `false` | 툴바 삭제 | `ConfirmDialog` |
| `imageStateRef` | `imageState` 미러 | 두 핸들러가 state와 함께 갱신 | `saveImageDraft`가 최신값을 읽는다 |
| `lastImageTapRef` | `0` | `handleDoubleTap` | 300ms 더블탭 판정 |

`saveImageDraft`는 `imageStateRef.current`를 읽어 좌표·크기를 반올림해 `onUpdate`에 넘긴다. `z`는 `image.z`를 그대로 쓴다.

## 저장 트리거

편집 중에 **빈 보드에서 pointerup**이 일어나면 저장한다.

```text
.board-scroll-layer 안이고
.image-rnd-{id} 밖이고
.board-toolbar 밖이면
  → setTimeout(0)으로 saveImageDraft() → onEditingClear()
```

`setTimeout(0)`은 같은 이벤트 루프에서 일어나는 다른 상태 변경 뒤로 저장을 미루기 위한 것이다. 리스너는 `document`의 `pointerup`이다.

## 그 밖의 핸들러

| 핸들러 | 동작 |
| --- | --- |
| `editImage()` | `onEditing()`만 호출. 권한 검사가 없다 |
| `handleDoubleTap` | `pointerType === "touch"`이고 300ms 이내 재탭이면 `editImage()`. `preventDefault`는 호출하지 않는다 |
| `handleImagePress` | `stopPropagation()`만 한다 |
| `confirmDelete` | `onDelete(imageId)` → 대화상자 닫기 → `onEditingClear()` |

`confirmDelete`의 호출 순서는 `MermaidCard`/`TableCard`와 뒤 두 개가 반대다.

## 렌더 구조

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| `Rnd` | 항상 | `className="image-rnd-{id}"`, `zIndex: isEditing ? ACTIVE_CARD_Z : image.z`, `bounds="parent"`, `minWidth`/`minHeight` 48 |
| `<img>` | `data` 또는 `url`이 있을 때 | `object-contain`, `draggable={false}` |
| `ImageToolBar` | `isEditing` | `onDelete={openDeleteDialog}` |
| `ConfirmDialog` | `deleteDialogOpen` | 문구 `Delete this image?` |

드래그 핸들이 따로 없다. 편집 중에는 카드 전체를 끌 수 있다.

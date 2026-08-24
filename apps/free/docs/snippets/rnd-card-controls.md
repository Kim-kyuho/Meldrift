# Rnd 카드 조작

## 기본 구조

`react-rnd`는 위치와 크기를 controlled value로 관리한다.

```tsx
<Rnd
  position={{ x: state.x, y: state.y }}
  size={{ width: state.width, height: state.height }}
  bounds="parent"
  scale={zoom}
  disableDragging={!canMove}
  enableResizing={canResize}
  onDragStop={handleDragStop}
  onResizeStop={handleResizeStop}
/>
```

## 이동

```tsx
const handleDragStop = (_event: RndDragEvent, data: DraggableData) => {
  setCardState((prev) => ({
    ...prev,
    x: data.x,
    y: data.y,
  }));
};
```

## 리사이즈

```tsx
const handleResizeStop: RndResizeCallback = (
  _event,
  _direction,
  ref,
  _delta,
  position,
) => {
  setCardState({
    x: position.x,
    y: position.y,
    width: ref.offsetWidth,
    height: ref.offsetHeight,
  });
};
```

## 드래그 핸들

전체 카드를 움직이지 않고 특정 영역만 이동 핸들로 사용한다.

```tsx
<Rnd
  dragHandleClassName="memo-drag-handle"
  disableDragging={!isEditing}
>
  <div className="memo-drag-handle cursor-grab" />
</Rnd>
```

## 줌 보정

보드가 `transform: scale()`로 확대/축소되면 Rnd에도 같은 zoom 값을 전달한다.

```tsx
<Rnd scale={zoom} />
```

Meldrift 적용 위치:

- `components/MemoCard.tsx`
- `components/ImageCard.tsx`
- `hooks/useMemoCard.ts`
- `hooks/useImageCard.ts`

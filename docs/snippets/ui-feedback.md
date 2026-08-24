# UI 피드백

## 눌림 피드백

버튼 내부에서 `pressed` state를 관리한다.

```tsx
const [pressed, setPressed] = useState(false);

<button
  className={`${baseClassName} ${pressed ? pressedClassName : ""}`}
  onTouchStart={() => setPressed(true)}
  onTouchEnd={() => setPressed(false)}
  onTouchCancel={() => setPressed(false)}
/>
```

## Tailwind active 피드백

```tsx
className="
  transition duration-150 ease-out
  hover:bg-neutral-100 hover:shadow-sm
  active:scale-[0.97] active:bg-neutral-200
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300
"
```

## 리사이즈 피드백

```tsx
const [isResizing, setIsResizing] = useState(false);

const handleResizeStart = () => {
  setIsResizing(true);
};

const handleResizeStop = () => {
  setIsResizing(false);
};
```

```tsx
{isResizing && (
  <div className="pointer-events-none absolute inset-0 z-20 animate-pulse rounded-xl border-2 border-dashed border-pink-500" />
)}
```

## 드래그 핸들 피드백

```tsx
const [dragHandlePressed, setDragHandlePressed] = useState(false);
```

```tsx
<div
  className="memo-drag-handle"
  onPointerDown={() => setDragHandlePressed(true)}
  onPointerUp={() => setDragHandlePressed(false)}
  onPointerCancel={() => setDragHandlePressed(false)}
  onPointerLeave={() => setDragHandlePressed(false)}
>
  <div className={dragHandlePressed ? "bg-black/70" : "bg-black/25"} />
</div>
```

## 메시지 표시

`BoardMessage`가 빈 문자열을 스스로 걸러내므로 호출부에서 조건부 렌더를 하지 않는다. `onDismiss`를 넘기면 3500ms 후 메시지가 자동으로 사라진다.

```tsx
const [permissionMessage, setPermissionMessage] = useState("");

<BoardMessage
  type="permission"
  message={permissionMessage}
  onDismiss={() => setPermissionMessage("")}
/>
```

Meldrift 적용 위치:

- `components/PressableButton.tsx`
- `components/MemoCard.tsx`
- `components/BoardMessage.tsx`
- `components/BoardZoomControl.tsx`

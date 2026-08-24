# 컨텍스트 메뉴

## 공통 인터페이스

```tsx
type ContextMenuPosition = {
  x: number;
  y: number;
};
```

```tsx
type DeleteMenuProps = {
  ref?: Ref<HTMLDivElement>;
  contextMenuPosition: ContextMenuPosition;
  zoom?: number;
  onDelete: () => void;
};
```

## 메뉴 위치

보드 좌표를 기준으로 메뉴를 띄운다.

```tsx
style={{
  left: `${contextMenuPosition.x}px`,
  top: `${contextMenuPosition.y}px`,
}}
```

## 줌 보정

보드가 확대되어도 메뉴는 화면 기준 크기를 유지한다.

```tsx
style={{
  transform: `scale(${0.8 / zoom})`,
  transformOrigin: "top left",
}}
```

값 기준:

- `1 / zoom`: 화면 기준 100%
- `0.8 / zoom`: 화면 기준 80%
- `1.2 / zoom`: 화면 기준 120%

## 메모 색상 메뉴

색상별 함수를 만들지 않고 배열과 공통 핸들러로 처리한다.

```tsx
const memoColors = [
  { name: "Yellow", value: "#fffadc" },
  { name: "Pink", value: "#ffe4ec" },
  { name: "Blue", value: "#e0f2fe" },
  { name: "Green", value: "#dcfce7" },
];

const handleColorSelect = (color: string) => {
  onChangeColor?.(color);
  setOpenMemoColorMenu(false);
};
```

렌더링:

```tsx
{memoColors.map((color) => (
  <button
    key={color.value}
    type="button"
    title={color.name}
    className="flex items-center gap-2 rounded-md px-2 py-1.5 transition"
    onClick={() => handleColorSelect(color.value)}
  >
    <span
      className="h-6 w-6 rounded-full border"
      style={{ backgroundColor: color.value }}
    />
    <span className="text-xs text-neutral-700">{color.value}</span>
  </button>
))}
```

## 메뉴 분리 기준

- `MemoContextMenu`: 메모 색상, 코드블럭, 삭제
- `ImageContextMenu`: 이미지 삭제
- `BoardContextMenu`: 보드 삭제

Meldrift 적용 위치:

- `components/MemoContextMenu.tsx`
- `components/ImageContextMenu.tsx`
- `components/BoardContextMenu.tsx`
- `hooks/useMemoContextMenu.ts`

# 카드 도구 메뉴

카드 편집 도구는 카드 옆에 뜨는 컨텍스트 메뉴가 아니라, 화면 오른쪽 아래 고정 슬롯에 포탈로 렌더링하는 툴바다. 툴바 버튼 중 선택지가 여러 개인 항목만 팝업 메뉴를 연다.

## 포탈 슬롯

툴바 자리를 한 곳으로 고정하고, 편집 중인 카드가 그 자리를 차지한다.

```tsx
<div id="card-tool-portal" className="fixed bottom-16 right-5 z-50000" />
```

```tsx
export function CardToolPortal({ children, animate = true }: CardToolPortalProps) {
  const target = document.getElementById("card-tool-portal");

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}
```

일반 보드 도구와 카드 전용 툴바가 같은 좌표를 쓰므로, 편집 진입 시 자리를 교대하는 것처럼 보인다.

## 팝업 메뉴 상호 배타

한 툴바 안에 팝업이 둘 이상이면 하나를 열 때 나머지를 닫는다.

```tsx
const toggleColorMenu = () => {
  setOpenMemoColorMenu((prev) => !prev);
  setOpenHeadingMenu(false);
};

const toggleHeadingMenu = () => {
  setOpenHeadingMenu((prev) => !prev);
  setOpenMemoColorMenu(false);
};
```

모드를 전환할 때도 열린 팝업을 모두 닫는다.

```tsx
const changeToolMode = (mode: "main" | "format" | "block") => {
  setOpenMemoColorMenu(false);
  setOpenHeadingMenu(false);
  setToolMode(mode);
};
```

## 옵션 배열과 공통 핸들러

옵션마다 함수를 만들지 않고 배열과 공통 핸들러로 처리한다. 선택 즉시 팝업을 닫는다.

```tsx
const memoColors = [
  { name: "Yellow", value: "#fffadc" },
  { name: "Pink", value: "#ffe4ec" },
  { name: "Blue", value: "#e0f2fe" },
  { name: "Green", value: "#dcfce7" },
  { name: "Lavender", value: "#ede9fe" },
  { name: "Peach", value: "#ffedd5" },
  { name: "Mint", value: "#ccfbf1" },
  { name: "Gray", value: "#f1f5f9" },
];

const handleColorSelect = (color: string) => {
  onChangeColor?.(color);
  setOpenMemoColorMenu(false);
};
```

## 팝업 배치

팝업은 버튼 왼쪽에 붙인다. 옵션 수가 많으면 그리드, 적으면 한 줄로 편다.

```tsx
{openMemoColorMenu && (
  <div className="absolute right-full top-0 mr-2 grid w-40 grid-cols-4 place-items-center gap-1.5 rounded-md bg-white p-2 shadow-md">
    {memoColors.map((color) => (
      <button
        key={color.value}
        type="button"
        aria-label={color.name}
        title={color.name}
        className="h-8 w-8 rounded-full border border-neutral-300 transition hover:scale-105 active:scale-95"
        style={{ backgroundColor: color.value }}
        onClick={() => handleColorSelect(color.value)}
      />
    ))}
  </div>
)}
```

색상 스와치는 아이콘 대신 배경색 자체가 라벨이므로 `aria-label`과 `title`로 이름을 준다.

## 모드 전환 애니메이션

포탈 자체의 애니메이션을 끄고 내부 `div`에 `key`를 줘서, 모드가 바뀔 때마다 재마운트로 등장 애니메이션을 다시 재생시킨다.

```tsx
<CardToolPortal animate={false}>
  <div key={toolMode} className="toolbar-reveal flex flex-col items-end gap-1">
```

## 툴바 분리 기준

- `MemoToolBar`: 색상, 서식(제목·굵게·기울임·취소선·강조), 블록(구분선·코드블럭·인용), 레이어, 삭제
- `ImageToolBar` / `MermaidToolBar` / `TableToolBar`: 레이어, 삭제와 각 타입 고유 도구
- `DrawingToolBar`: 펜 색상, 굵기, 지우개, 팬, undo

Meldrift 적용 위치:

- `packages/ui/src/components/CardToolPortal.tsx`
- `packages/ui/src/components/MemoToolBar.tsx`
- `packages/ui/src/components/DrawingToolBar.tsx`
- `packages/ui/src/hooks/useMemoToolBar.ts`

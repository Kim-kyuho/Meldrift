# DB 저장 흐름

## 임시 생성 후 저장

DB 저장 전에 화면에 먼저 임시 데이터를 추가한다.

```tsx
const tempMemo = {
  id: -Date.now(),
  boardId,
  content: "",
  x,
  y,
  width: 300,
  height: 200,
  color: "#fffadc",
};

setMemos((prev) => [...prev, tempMemo]);
```

임시 ID 기준:

- `id < 0`: 아직 DB에 없는 임시 데이터
- `id > 0`: DB에 저장된 실제 데이터

## Insert / Update 분기

```tsx
const saveMemo = () => {
  if (memo.id < 0) {
    insertMemo();
    return;
  }

  updateMemo();
};
```

## Insert 후 실제 데이터로 교체

```tsx
setMemos((prev) =>
  prev.map((memo) =>
    memo.id === tempId ? data.memo : memo
  )
);
```

## Update 후 화면 state 반영

```tsx
setMemos((prev) =>
  prev.map((memo) =>
    memo.id === id
      ? { ...memo, content, x, y, width, height, color }
      : memo
  )
);
```

## Delete

임시 데이터는 API 호출 없이 제거한다.

```tsx
if (id < 0) {
  setMemos((prev) => prev.filter((memo) => memo.id !== id));
  return;
}
```

DB 데이터는 API 삭제 후 state에서 제거한다.

```tsx
await fetch(`/api/memos/${id}`, { method: "DELETE" });

setMemos((prev) => prev.filter((memo) => memo.id !== id));
```

Meldrift 적용 위치:

- `hooks/useBoardMemos.ts`
- `hooks/useBoardImages.ts`
- `packages/ui/src/hooks/useMemoCard.ts`
- `hooks/useImageCard.ts`

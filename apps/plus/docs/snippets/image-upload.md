# 이미지 업로드

## input ref

숨겨진 파일 input을 ref로 클릭한다.

```tsx
const imageInputRef = useRef<HTMLInputElement | null>(null);

const handleImageUploadClick = () => {
  imageInputRef.current?.click();
};
```

```tsx
<input
  ref={imageInputRef}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={handleUploadImage}
/>
```

## 현재 화면 중앙에 생성 위치 계산

```tsx
const cardLocationRef = useRef<HTMLElement | null>(null);

const getImageUploadPoint = () => {
  const scrollElement = cardLocationRef.current;
  if (!scrollElement) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.max(0, (scrollElement.scrollLeft + scrollElement.clientWidth / 2) / boardZoom - 200),
    y: Math.max(0, (scrollElement.scrollTop + scrollElement.clientHeight / 2) / boardZoom - 150),
  };
};
```

## FormData 전송

```tsx
const formData = new FormData();
formData.append("file", file);
formData.append("boardId", String(boardId));
formData.append("x", String(x));
formData.append("y", String(y));
formData.append("width", String(width));
formData.append("height", String(height));

const response = await fetch("/api/images", {
  method: "POST",
  body: formData,
});
```

## Cloudinary upload_stream

```ts
const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);

const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: `kyuboard/boards/${boardId}` },
    (error, result) => {
      if (error || !result) {
        reject(error ?? new Error("Cloudinary upload failed"));
        return;
      }

      resolve(result);
    },
  );

  uploadStream.end(buffer);
});
```

## 초기 이미지 크기 계산

```ts
const maxWidth = 400;
const maxHeight = 300;
const scale = Math.min(
  maxWidth / uploadResult.width,
  maxHeight / uploadResult.height,
  1,
);

const width = Math.round(uploadResult.width * scale);
const height = Math.round(uploadResult.height * scale);
```

Meldrift 적용 위치:

- `hooks/useBoardImages.ts`
- `app/api/images/route.ts`
- `components/ImageCard.tsx`

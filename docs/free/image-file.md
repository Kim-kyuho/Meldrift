# 로컬 이미지 처리 상세설계

소스: `lib/image-file.ts`

## 목적

Free Edition은 이미지 저장소를 쓰지 않는다. 사용자가 고른 파일을 브라우저에서 압축해 SQLite BLOB으로 넣을 수 있는 크기까지 줄인다. 이미지가 DB 안에 들어가므로 한 장의 크기가 곧 세이브 파일 크기다.

## 상수

| 이름 | 값 | 의미 |
| --- | --- | --- |
| `imageInputAccept` | `image/jpeg,image/png,image/webp` | 파일 선택 필터 |
| `maxImageSourceBytes` | 25 MiB | 받아들이는 원본 상한 |
| `maxStoredImageBytes` | 5 MiB | DB에 넣는 결과물 상한 |
| `maxImageDimension` | 1920 | 긴 변 상한 |
| `imageCompressionQuality` | 0.82 | WebP 첫 품질 |

`supportedImageMimeTypes`는 JPEG·PNG·WebP 셋이다. `lib/board-state.ts`의 이미지 검증도 이 목록과 `maxStoredImageBytes`를 그대로 쓴다.

## `prepareImageFile(file)`

1. MIME이 지원 목록에 없으면 `Choose a JPEG, PNG, or WebP image.`
2. 0바이트이거나 25 MiB를 넘으면 `The source image must be 25 MiB or smaller.`
3. object URL로 `Image`를 로드한다. 디코드 실패는 `The selected image could not be decoded.`
4. `naturalWidth`/`naturalHeight`가 1 미만이면 거부한다.
5. `fitImageSize`로 긴 변을 1920 이하로 맞춘다.
6. 아래 축소 루프를 최대 10회 돈다.
7. 결과가 여전히 5 MiB를 넘으면 `The image is still too large after compression.`
8. 표시 크기는 `fitImageSize(캔버스, 400, 300)`으로 정한다.

### 축소 루프

```text
canvas를 outputSize로 맞추고 다시 그린다
toBlob("image/webp", quality)
  → null이면 toBlob("image/png")로 대체
  → 그것도 null이면 The image could not be compressed.
결과가 5 MiB 이하면 끝
아니면 outputSize를 0.82배, quality를 0.04 낮춤(하한 0.55) 후 반복
```

WebP를 만들지 못하는 브라우저에서는 PNG로 떨어진다. 그 경우 품질 인자가 없어 크기 축소는 해상도 축소로만 이뤄진다.

반환값은 `{ data, mimeType, label, width, height }`이고 `label`은 원본 파일명이다.

## `imageBytesToPng(data, mimeType)`

Markdown 내보내기에서 zip에 넣을 PNG를 만든다. 이미 PNG면 복사본을 그대로 돌려주고, 아니면 디코드 후 원본 해상도 캔버스에 그려 PNG로 다시 인코딩한다. 여기서는 해상도를 줄이지 않는다.

## 그 밖

| 함수 | 동작 |
| --- | --- |
| `isSupportedImageMimeType(value)` | 타입 가드 |
| `fitImageSize(w, h, maxW, maxH)` | 비율 유지 축소. 확대하지 않는다(`scale ≤ 1`), 최소 1px |
| `imageBytesToBlob(data, mimeType)` | **바이트를 복사해서** Blob을 만든다 |

`imageBytesToBlob`이 복사하는 이유는 원본이 SQLite가 소유한 버퍼일 수 있어서다. 그대로 참조하면 DB가 닫히거나 재할당될 때 내용이 어긋날 수 있다.

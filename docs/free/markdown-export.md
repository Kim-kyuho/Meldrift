# Markdown 컴파일과 내보내기 상세설계 (Free)

소스: `lib/board-markdown.ts`, `hooks/useBoardMarkdown.ts`, `components/BoardMarkdownView.tsx`

## Plus와 갈리는 지점

문서 순서 규칙(메모 순서 → 메모 네 꼭짓점 → 겹친 카드 중 맨 위 한 장)은 두 Edition이 같다. 다른 것은 **어디서 계산하고 이미지를 어떻게 내보내는가**다.

| | Plus | Free |
| --- | --- | --- |
| 계산 위치 | 서버 Route Handler의 SQL | 브라우저에서 `compileBoardMarkdownDocument` |
| 이미지 | Cloudinary `secure_url`을 그대로 링크 | 바이트를 PNG로 변환해 zip에 동봉 |
| 내려받기 | `.md` 하나 | `.md` + `images/`를 담은 `.zip` |

## 컴파일 (`compileBoardMarkdownDocument`)

입력은 `BoardSnapshot`, 출력은 `{ markdown, imageAssets }`다.

카드 목록을 먼저 하나로 모은다. 이미지는 `data`와 `mimeType`이 모두 있을 때만 자산이 된다.

```text
imageAsset = { path: "images/image-{imageId}.png", data, mimeType }
content    = imageAsset ? "./images/image-{imageId}.png" : image.url
```

바이트가 없는 구버전 이미지는 원래 URL을 그대로 링크한다.

이어서 `sortMemosByOrder`로 정렬한 메모를 돌며 다음을 이어 붙인다.

1. 메모 본문을 Turndown으로 HTML → Markdown 변환한다. 결과가 빈 문자열이면 넣지 않는다.
2. 메모의 네 꼭짓점을 좌상 · 우상 · 좌하 · 우하 순으로 훑는다.
3. 각 꼭짓점을 **엄격히** 덮는 카드를 고른다(경계에 닿기만 한 것은 제외).
4. 겹친 카드가 여럿이면 `z` 내림차순 → `cardTypeOrder` → `id` 순으로 맨 위 한 장만 고른다.
5. 이미 문서에 넣은 카드는 건너뛴다. 한 카드는 문서 전체에서 한 번만 나온다.

카드 종류별 출력은 이렇다.

| 종류 | 출력 |
| --- | --- |
| image | `![라벨](경로)` — 라벨의 `[`/`]`는 이스케이프하고, 없으면 `Image` |
| mermaid | ` ```mermaid ` 코드 블록 |
| table | `tableSourceToMarkdown` 결과 |

Turndown 설정은 `headingStyle: atx`, `bulletListMarker: -`, `codeBlockStyle: fenced`이고 `~~취소선~~` 규칙을 추가한다. 조각은 빈 값을 걸러 `\n\n`으로 잇는다.

드로잉은 컴파일 대상이 아니다.

## 미리보기 (`useBoardMarkdown`)

`compileBoardMarkdownDocument`를 `useMemo`로 계산한다. 스냅샷이 바뀔 때만 다시 돈다.

`markdownSections`는 본문을 ` ```mermaid ` 블록 기준으로 쪼갠 배열이다. 화면은 홀수 인덱스를 Mermaid 렌더러로, 짝수 인덱스를 React Markdown으로 그린다.

이미지 자산이 있으면 effect가 자산마다 object URL을 만들어 `{ "./images/image-1.png": "blob:..." }` 맵을 만든다.

- 만드는 도중 실패하면 이미 만든 URL을 전부 해제하고 오류 문구를 담는다.
- `queueMicrotask`로 상태를 반영해 같은 커밋 안에서 setState가 겹치는 것을 피한다.
- cleanup에서 모든 object URL을 해제한다.

`previewReady`는 자산이 없거나, 저장된 미리보기 상태가 **현재 문서와 같은 객체**일 때 참이다. 스냅샷이 바뀐 직후 옛 URL이 잠깐 보이는 것을 막는다. 같은 판정으로 `previewImageUrls`와 `previewError`도 문서가 일치할 때만 내보낸다.

## zip 내려받기

```text
board-{boardId}.md      본문
images/image-{id}.png   자산 (있을 때만)
```

`imageBytesToPng`로 자산을 전부 PNG로 맞춘 뒤 `fflate.zipSync(files, { level: 6 })`로 묶는다. WebP로 압축해 저장한 이미지도 zip 안에서는 PNG가 된다.

파일명은 `meldrift-board-{boardId}.zip`이고 `<a download>`로 내려받은 뒤 object URL을 해제한다. 실패하면 `downloadError`에 문구를 담고, 성공·실패 모두 `downloading`을 되돌린다.

## 반환값

| 값 | 의미 |
| --- | --- |
| `markdown` | 컴파일된 본문 |
| `markdownSections` | Mermaid 블록 기준으로 쪼갠 배열 |
| `previewImageUrls` | 자산 경로 → object URL |
| `errorMessage` | 미리보기 오류가 우선, 없으면 내려받기 오류 |
| `loading` | 미리보기 URL이 아직 준비되지 않음 |
| `downloading` | zip 생성 중 |
| `handleMarkdownDownload` | zip 내려받기 |

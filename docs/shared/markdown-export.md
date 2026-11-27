# Markdown 컴파일, 선형 편집과 내보내기 상세설계

컴파일과 초안 변환은 `packages/board-data/src/board-markdown*.ts`에, 편집기와 미리보기는 `packages/ui/src/features/markdown/`에 있다.

## 어디서 계산하나

두 Edition 모두 **브라우저에서** `compileBoardMarkdownDocument`로 계산한다. 화면에 있는 스냅샷이 곧 입력이라 서버 왕복이 없다.

Plus에는 같은 문서를 서버에서 만드는 경로가 하나 더 있다. `GET /api/boards/[boardId]/markdown`은 delta 보드 상태를 먼저 읽어 공통 함수로 컴파일하고 이미지는 `/plus/api/boards/{id}/assets/{assetId}/bytes` 링크로 바꾼다. 이전 모드는 저장된 스냅샷과 `/snapshot/images/{imageId}`를 사용하고, 스냅샷도 없으면 구 SQL 경로를 사용한다. 보드 밖에서 저장된 문서를 받기 위한 경로다([Route Handler](../plus/api-routes.md)).

## 컴파일 (`compileBoardMarkdownDocument`)

입력은 `BoardSnapshot`이다. 결과의 `sections`는 메모와 연결된 첨부를 묶은 편집 단위이며, `unlinkedCardCount`는 문서에 포함되지 않은 이미지·표·Mermaid 카드 수다. 같은 섹션을 사용해 `markdown`과 `imageAssets`를 구성한다.

카드 목록을 먼저 하나로 모은다. 이미지는 `data`와 `mimeType`이 모두 있을 때만 자산이 된다.

```text
imageAsset = { path: "images/image-{imageId}.png", data, mimeType }
content    = imageAsset ? "./images/image-{imageId}.png" : image.url
```

바이트가 없는 이미지(Plus의 구버전 Cloudinary 이미지, 또는 서버 컴파일에서 링크로 바뀐 이미지)는 `url`을 그대로 링크한다.

이어서 `sortMemosByOrder`로 정렬한 메모를 돌며 각 섹션과 내보내기용 본문을 구성한다.

1. 메모 본문을 Turndown으로 HTML → Markdown 변환한다. 결과가 빈 문자열이면 넣지 않는다.
2. 메모의 네 꼭짓점을 좌상 · 우상 · 좌하 · 우하 순으로 훑는다.
3. 각 꼭짓점을 중심으로 반경 50px(`cornerLinkRadius`) 원형 영역과 겹치는(점과 카드 사각형 사이의 최단 거리가 50px 이하인) 카드를 고른다.
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

## 선형 편집과 적용

보드 메뉴에서 `Compile to Markdown`을 열면 넓은 화면에서 캔버스와 편집기가 나란히 표시된다. 좁은 화면에서는 편집기가 화면을 채운다. 편집 권한이 있으면 메모 본문, 표, Mermaid 소스, 이미지 캡션을 편집하거나 섹션을 추가·재정렬할 수 있다. 섹션당 첨부는 최대 4개다.

`useLinearMarkdownDraft`는 커밋된 보드에서 초안을 별도로 관리한다. `applyLinearDraftToSnapshot`은 초안을 적용한 스냅샷으로 편집기와 캔버스를 미리 보여준다. 초안은 `Apply`에서 보드에 반영한다. 이때 신규 카드에 정식 ID를 부여하고, 적용 결과를 보드의 이력과 자동 저장 흐름에 전달한다. 내려받기는 편집기에 표시된 스냅샷을 사용한다.

편집 권한이 있고 미적용 변경이 있을 때 닫기를 누르면 `Keep Editing`, `Discard & Close`, `Apply & Close`를 제공한다. 편집기 열림 상태나 대상 보드가 바뀌면 초안을 초기화한다.

## 이미지 첨부와 미리보기

이미지 파일을 선택하면 공통 `prepareImageFile`이 파일을 준비하고, 성공한 이미지를 선택한 섹션의 초안에 추가한다. 준비 중에는 `Apply`와 `Apply & Close`를 비활성화한다. 편집기를 닫거나 초안을 버린 뒤 도착한 준비 결과는 반영하지 않는다. 캡션은 입력 중 공백을 유지하고 적용할 때 앞뒤 공백을 정리한다.

`useBoardMarkdown`은 컴파일 결과의 이미지 바이트 객체와 MIME 타입을 기준으로 Blob URL을 재사용한다. 본문·캡션을 바꾸거나 적용 중 이미지 ID가 확정되어 자산 경로가 바뀌어도 같은 바이트의 URL을 유지한다. 현재 문서에서 빠진 자산과 편집기를 닫을 때 남은 자산의 URL은 해제한다. 미리보기 준비나 오류 표시 중에도 편집 영역을 유지한다.

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
| `sections` | 메모·첨부로 구성된 문서 섹션 |
| `unlinkedCardCount` | 문서에 포함되지 않은 카드 수 |
| `previewImageUrls` | 자산 경로 → object URL |
| `errorMessage` | 미리보기 오류가 우선, 없으면 내려받기 오류 |
| `loading` | 미리보기 URL이 아직 준비되지 않음 |
| `downloading` | zip 생성 중 |
| `handleMarkdownDownload` | zip 내려받기 |

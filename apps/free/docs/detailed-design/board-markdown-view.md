# BoardMarkdownView 상세설계

소스: `components/BoardMarkdownView.tsx`, `hooks/useBoardMarkdown.ts`, `lib/board-markdown.ts`, `lib/image-file.ts`

`BoardMarkdownView`는 현재 `BoardSnapshot`을 받아 브라우저에서 Markdown 문서와 이미지 자산 목록을 만든다. 서버 API나 DB 재조회는 없다.

## 컴파일

- Memo의 TipTap HTML은 Turndown으로 Markdown으로 변환한다.
- Memo 모서리와 겹치는 최상단 이미지, Mermaid, 표를 문서에 한 번씩 삽입한다.
- Memo가 하나도 없으면 이미지·Mermaid·표도 컴파일하지 않는다. 카드가 Memo와 겹쳐도 Memo의 네 모서리 중 하나가 카드 내부에 들어가지 않으면 제외한다. 이는 기존 문서 구성 규칙이다.
- `compileBoardMarkdownDocument`는 Markdown 문자열과 실제로 문서에 삽입된 로컬 이미지 자산만 반환한다.
- 로컬 이미지는 `./images/image-{imageId}.png` 상대 경로로 기록하고 원본 바이트와 MIME 타입은 이미지 자산에 보관한다.
- 기존 v1 HTTP(S) 이미지는 원격 URL을 그대로 기록하고 다운로드 자산에는 포함하지 않는다.
- Mermaid는 fenced code block, 표는 GFM table로 변환한다.
- Mermaid fenced block은 일반 Markdown과 분리해 `useMermaidRenderer`로 렌더링한다.

## 미리보기

일반 구간은 `ReactMarkdown`과 GFM을 사용한다. 원본 HTML은 `rehypeRaw` 다음 `rehypeSanitize` 순서로 처리한다. 로컬 이미지는 저장된 JPEG, PNG, WebP 바이트를 MIME 타입이 지정된 Blob으로 만들고 `URL.createObjectURL`로 미리보기 URL을 생성한다. 렌더러의 `img`가 컴파일러에서 생성한 상대 경로를 해당 Blob URL로 치환한다.

컴파일 결과가 바뀌거나 모달이 닫히면 모든 Blob URL을 해제한다. 이는 브라우저 메모리의 임시 참조만 폐기하는 동작이며 IndexedDB의 SQLite 파일과 이미지 BLOB은 그대로 유지한다.

## ZIP 다운로드

다운로드 버튼은 `fflate`로 다음 파일을 하나의 ZIP으로 만든다.

```text
meldrift-board-{boardId}.zip
├── board-{boardId}.md
└── images/
    └── image-{imageId}.png
```

- Markdown은 UTF-8로 인코딩한다.
- 저장된 이미지가 PNG면 바이트를 복사하고, JPEG 또는 WebP면 Canvas로 디코딩한 뒤 실제 PNG 바이트로 다시 인코딩한다.
- 변환은 ZIP 다운로드 시점에만 수행하며 SQLite에 저장된 압축 이미지와 MIME 타입은 수정하지 않는다.
- ZIP 생성 중에는 다운로드 버튼을 비활성화해 중복 실행을 막는다.
- 이미지 디코딩이나 ZIP 생성이 실패하면 파일을 다운로드하지 않고 모달에 오류를 표시한다.

이 ZIP은 Markdown 문서 전달용이다. 보드 전체를 복원하는 `meldrift-free.sqlite` Export와 역할이 다르다.

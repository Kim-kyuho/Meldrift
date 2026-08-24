# BoardMarkdownView 상세설계

소스: `components/BoardMarkdownView.tsx`, `hooks/useBoardMarkdown.ts`

이 파일은 두 컴포넌트로 구성된다: 내부 전용 `MarkdownMermaid`(19~43줄)와 기본 export `BoardMarkdownView`(45~122줄).

## BoardMarkdownView Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `boardId` | `number` | `useBoardMarkdown(boardId)`에 전달 |
| `onClose` | `() => void` | 오버레이 클릭(59줄), 헤더 X 버튼(70줄) |

## `useBoardMarkdown(boardId)` State (`hooks/useBoardMarkdown.ts`)

| State | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `markdown` | `""` | fetch 성공 시 `data.markdown ?? ""` (42줄) | `markdownSections` 계산, 다운로드 버튼 노출 조건, 본문 렌더 |
| `errorMessage` | `""` | fetch 실패(`!response.ok \|\| !data.ok`) 또는 예외 시 (38, 48줄) | 본문에 에러 문구 렌더 |
| `loading` | `true` | fetch `finally` 블록에서 `false` (단, `AbortController`로 취소된 요청이면 갱신 안 함, 50~52줄) | 본문 로딩 문구, 다운로드 버튼 노출 조건 |

### 로딩 effect (27~59줄)

1. 마운트 시 `AbortController` 생성, `GET /api/boards/{boardId}/markdown` 호출(`signal` 포함)
2. 실패 조건 → `errorMessage` 설정
3. `AbortError`는 무시(언마운트/`boardId` 변경으로 인한 정상 취소)
4. `boardId`가 바뀌면 cleanup에서 이전 요청을 `abort()`하고 재실행 (58줄, deps `[boardId]`)

### `markdownSections` 파생값 (62줄)

`markdown.split(/```mermaid\s*\r?\n([\s\S]*?)```/g)` — 캡처 그룹 포함 정규식이라 `split` 결과가 **[일반텍스트, mermaid소스, 일반텍스트, mermaid소스, ...]** 순서로 번갈아 나온다. 즉 배열 인덱스가 짝수면 일반 Markdown, 홀수면 Mermaid 소스.

### `handleMarkdownDownload()` (14~25줄)

1. `new Blob([markdown], { type: "text/markdown;charset=utf-8" })`
2. `URL.createObjectURL` → 숨겨진 `<a>` 생성 → `download="board-{boardId}.md"` → 클릭 → 즉시 `remove()` + `revokeObjectURL`

## `MarkdownMermaid` 서브컴포넌트 (19~43줄)

| Prop | 사용처 |
| --- | --- |
| `source` | `useMermaidRenderer({ source, mermaidId: diagramId })`에 전달 |
| `diagramId` | 위와 동일, 렌더러 캐시/식별 키로 사용(상세: `useMermaidRenderer` 문서) |

렌더 분기: `renderError`가 있으면 에러 `<pre>`, 없고 `svg`도 없으면 "Rendering..." 문구, `svg`가 있으면 `dangerouslySetInnerHTML`로 삽입.

## BoardMarkdownView 렌더 구조 (54~122줄)

| 요소 | z-index | 조건 |
| --- | --- | --- |
| 오버레이 (56줄) | 60000 | 항상, 클릭 시 `onClose` |
| 패널 `section` (61줄) | 60001 | `aria-label="Compiled Markdown document"` |
| 다운로드 버튼 (79줄) | - | `markdown && !loading && !errorMessage`일 때만 |
| 본문 4단 분기 (89~115줄) | - | `loading` → "Compiling..." / `errorMessage` → 에러 문구 / `markdown` truthy → 섹션 렌더 / 그 외 → "No memo content exists." |
| 섹션 렌더 (95~111줄) | - | `index % 2 === 1`이면 `MarkdownMermaid`, 아니면 `ReactMarkdown`(`remarkGfm` + `rehypeRaw` + `rehypeSanitize`) |

## 알려진 특이사항

- `rehypeRaw`로 원본 HTML을 파싱한 뒤 `rehypeSanitize`로 정화하는 순서라, 컴파일된 Markdown 안에 포함된 임의 HTML(예: 사용자가 Tiptap에서 만든 `<br>` 등)이 살아남되 위험 태그/속성은 제거되는 구조 — 두 플러그인 순서가 바뀌면 sanitize가 무력화될 수 있어 순서 자체가 보안상 중요하다.
- `markdown.split` 정규식은 코드 펜스 언어 태그가 정확히 소문자 ` ```mermaid `일 때만 매치한다 — 대소문자가 다르거나 언어 태그 앞뒤 공백이 예상과 다르면 Mermaid 섹션이 분리되지 않고 일반 텍스트로 렌더된다.

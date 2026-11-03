# MemoEditor 상세설계

소스: `packages/ui/src/features/memo/MemoEditor.tsx`
편집 엔진: `@meldrift/markdown-engine` (`packages/ui` 의존성)

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `ref` | `Ref<MemoEditorHandle>`, 옵셔널 (React 19 prop-ref 문법) | `useImperativeHandle`로 8개 명령 노출 (306~347줄) |
| `content` | `string` (HTML) | 마운트 시 엔진 `html` 옵션의 초기값(216줄), 외부 동기화 effect의 비교 대상(240~250줄) |
| `onChange` | `(content: string) => void` | 엔진 `onChange`(217~224줄)와 툴바의 DOM 직접 수정 뒤(276~278줄)에 `editor.getHTML()` 전달 |

## Ref

이 컴포넌트에는 `useState`가 없다. 문서 상태는 엔진이 편집 영역의 DOM으로 직접 관리한다.

| Ref | 역할 |
| --- | --- |
| `elementRef` | 엔진이 붙는 편집 영역 `div` |
| `editorRef` | `createEditor` 반환값(`getHTML`, `setHTML`, `exec`, `destroy` 등) |
| `onChangeRef` | 최신 `onChange`. 엔진 콜백은 마운트 때 한 번만 넘기므로 ref로 최신 값을 참조한다(203~205줄) |
| `lastContentRef` | 마지막으로 알리거나 불러온 HTML. 외부 동기화 effect가 자기가 알린 값을 다시 불러오지 않게 비교한다 |
| `silentRef` | `true`인 동안 엔진 `onChange`를 무시한다. 불러오기 중의 알림을 막는다 |

## 엔진 연결 (207~238줄, deps `[]`)

1. `silentRef`를 켠 채로 `createEditor(element, { html, onChange })`를 호출한다. 엔진은 생성할 때 `setHTML`을 거치며 `onChange`를 한 번 부르는데, 사용자가 고친 내용이 아니므로 무시한다. 그래서 메모를 열었다 닫기만 하면 저장 내용이 바뀌지 않는다.
2. `setTimeout(..., 0)` 뒤에 편집 영역에 포커스하고 `placeCaretAtEnd`로 커서를 문서 끝에 둔다.
3. 언마운트 시 타이머를 지우고 `editor.destroy()`로 엔진 이벤트를 해제한다.

엔진의 `setHTML`은 저장된 HTML을 정리해서 불러온다. 허용된 태그만 남기고, `<li><p>`는 `<li>`로, `<s>`는 `<del>`로 바꾸고, `<mark>`와 링크의 속성(`target`, `rel` 등)을 지우고, 빈 문단에는 `<br>`을 넣는다. 예전 TipTap HTML도 이 경로로 그대로 편집할 수 있다.

## 외부 → 내부 동기화 (240~250줄, deps `[content]`)

`content !== lastContentRef.current`일 때만 `silentRef`를 켠 채로 `editor.setHTML(content)`를 부른다. 사용자가 입력해 `onChange`로 올라간 값은 `lastContentRef`와 같으므로 다시 불러오지 않는다(무한 루프와 커서 초기화 방지).

## `MemoEditorHandle` 명령 (306~347줄)

선택 위치가 이미 해당 서식 안이면 끄고, 아니면 켠다.

| 메서드 | 켜기 | 끄기 |
| --- | --- | --- |
| `toggleHeading(level)` | H1~H3는 `exec("h1"~"h3")`, H4~H6는 브라우저 `formatBlock` | 같은 레벨 제목 안이면 `exec("p")` |
| `toggleBold()` / `toggleItalic()` | `exec("bold")` / `exec("italic")` | 같은 명령을 다시 실행하면 브라우저가 해제 |
| `toggleStrike()` | `exec("strikeThrough")` (`<strike>` 생성) | `del`, `s`, `strike` 안이면 그 요소를 풀어낸다. 엔진의 `~~` 입력은 `<del>`을 만들어 `exec`로는 해제되지 않는다 |
| `toggleHighlight()` | 선택 영역을 `<mark>`로 감싼다(`wrapSelection`). 블록 경계를 넘는 선택은 무시 | `mark` 안이면 그 요소를 풀어낸다 |
| `toggleBlockQuote()` | `exec("blockquote")` | `unwrapBlockQuote`: 안의 블록을 밖으로 꺼내고, 글자만 있으면 `<p>`로 감싼다 |
| `toggleCodeBlock()` | `exec("pre")` | `unwrapCodeBlock`: `<pre>`(또는 안의 `<code>`) 글자를 `<p>`로 옮긴다 |
| `setHorizontalRule()` | 브라우저 `insertHorizontalRule` | (토글 없음) 글 끝에 넣었으면 `addParagraphAfterRule`이 뒤에 `<p><br></p>`를 추가해 이어 쓸 수 있게 한다 |

### 명령 실행 경로

| 경로 | 함수 | 변경 알림 |
| --- | --- | --- |
| 엔진 `exec` | `runCommand` (252줄) | 엔진이 알린다 |
| 브라우저 명령 | `runBrowserCommand` (258줄) | 브라우저가 `input` 이벤트를 보내므로 엔진이 알린다 |
| DOM 직접 수정 | `changeDocument` (264줄) | `input` 이벤트가 없으므로 `getHTML()`을 직접 `onChange`로 보낸다 |

세 경로 모두 먼저 편집 영역에 `focus()`한다. 툴바 버튼이 포커스를 가져가도 문서의 선택 영역은 남아 있으므로, 선택 영역이 필요한 엔진 `exec`가 그대로 동작한다.

`keepSelection` (109~124줄)은 요소를 풀어낼 때 쓴다. 풀어낸 요소에 걸려 있던 선택 영역은 사라지므로, 변경 전 선택 위치를 편집 영역 처음부터의 글자 수로 기억했다가 변경 뒤 같은 위치로 되돌린다.

## `handleEditorPointerUp` (349~360줄)

1. `event.preventDefault()` 항상 실행
2. 포인터 타입이 `touch`/`mouse`가 아니면(예: `pen`) 종료
3. 편집 영역에 포커스가 없을 때만 포커스하고 커서를 문서 끝에 둔다. 이미 포커스돼 있으면 아무것도 하지 않는다

## 렌더 (362~368줄)

`<div ref={elementRef} className="memo-editor-content" onPointerUp={handleEditorPointerUp} />` — 엔진이 이 `div`에 `contenteditable="true"`, `role="textbox"`, `aria-multiline="true"`를 붙인다. 보기 모드(`MemoCard`)와 같은 `memo-editor-content` 클래스를 써서 편집·보기 모양이 같다.

## 입력 변환

`#`, `>`, `-`, `1.`, `**`, `*`, `~~`, `==`, `` ` ``, ` ``` `, `---` 같은 Markdown 입력 변환과 Shift+Enter 줄바꿈은 엔진이 처리한다. Meldrift 쪽에는 입력 규칙 코드가 없다. 지원 범위는 엔진 README를 따른다.

## 스타일

- 엔진 테마 클래스 `meldrift-markdown`은 쓰지 않는다. 메모 모양은 `packages/ui/styles/globals.css`의 `.memo-editor-content` 규칙이 정한다.
- `globals.css`가 엔진 `style.css`를 불러오는 이유는 `document.body`에 뜨는 코드 블록 언어 입력칸의 스타일과 CSS 변수 때문이다.
- 편집 표시용 규칙 2개를 `.memo-editor-content`에 둔다: Shift+Enter 줄의 `[data-meldrift-soft-gap]` 숨김, 커서가 있는 서식의 기호(`**` 등)인 `[data-meldrift-delimiter]` 색.
- 편집 표시용 요소는 엔진 `getHTML()`이 제거하므로 저장된 HTML에는 들어가지 않는다.

## 테스트

`apps/free/tests/e2e/memo-editor.spec.ts` — 저장 후 다시 열었을 때 서식 유지, 툴바 인라인 서식·제목·인용·코드 블록 토글, 글 끝 구분선 뒤 이어 쓰기.

## 알려진 특이사항

- 브라우저 명령이나 DOM 직접 수정으로 처리한 툴바 동작(H4~H6, 구분선, 형광펜, 취소선 해제, 인용·코드 블록 해제)은 엔진의 실행 취소 기록에 남지 않는다. 직후 Cmd+Z를 누르면 엔진이 기억하는 그 앞 단계까지 함께 되돌아간다(Chromium에서는 직전에 입력한 글자까지 지워진다). 엔진 `exec`가 이 명령들을 지원하거나 실행 취소 지점을 저장하는 API가 생기면 해결된다.
- 툴바 취소선은 `<strike>`, Markdown `~~` 입력은 `<del>`을 만든다. 툴바 코드 블록은 `<pre>`만, ` ``` ` 입력은 `<pre><code>`를 만든다. 보이는 모양은 같다.
- 엔진이 HTML을 불러올 때 링크의 `target`을 지우므로, 다시 편집해 저장한 메모의 링크는 같은 탭에서 열린다.
- 형광펜 색은 `.memo-editor-content mark`의 `#fbca93` 하나뿐이다.
- `handleEditorPointerUp`은 `pen` 포인터 타입을 제외한다. Apple Pencil 등으로 메모를 누르면 이 포커스 처리가 적용되지 않는다(드로잉 레이어의 펜 우선 처리와 같은 방향).

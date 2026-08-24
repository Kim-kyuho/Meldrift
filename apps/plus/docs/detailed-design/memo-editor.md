# MemoEditor 상세설계

소스: `components/MemoEditor.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `ref` | `Ref<MemoEditorHandle>`, 옵셔널 (React 19 prop-ref 문법) | `useImperativeHandle`로 8개 명령 노출 (136~161줄) |
| `content` | `string` (HTML) | `useEditor`의 초기 `content`(125줄), 외부 동기화 effect의 비교 대상(163~167줄) |
| `onChange` | `(content: string) => void` | Tiptap `onUpdate`마다 `editor.getHTML()` 전달 (131~133줄) |

## `MemoEditorHandle` (84~93줄) — ref로 노출되는 명령

| 메서드 | 실행 커맨드 |
| --- | --- |
| `toggleCodeBlock()` | `editor.chain().focus().toggleCodeBlock().run()` |
| `toggleBlockQuote()` | `toggleBlockquote()` |
| `toggleHeading(level)` | `toggleHeading({ level })` |
| `toggleBold()` / `toggleItalic()` / `toggleStrike()` | 각 toggle 커맨드 |
| `setHorizontalRule()` | `setHorizontalRule()` |
| `toggleHighlight()` | `toggleHighlight({ color: "#fbca93" })` — **색상이 고정값**, 호출부(`MemoToolBar`)에서 색을 고를 수 없음 |

모든 메서드가 `editor?.` 옵셔널 체이닝을 쓰므로 `editor`가 아직 초기화되지 않았으면 조용히 아무 것도 하지 않는다. `useImperativeHandle`은 Tiptap `editor` 인스턴스 전체가 아니라 이 8개 메서드만 부모(`MemoCard`)에 노출한다(캡슐화).

## State

이 컴포넌트 자체는 `useState`가 없다. `useEditor(...)`가 반환하는 `editor` 인스턴스가 Tiptap 내부적으로 문서 상태를 관리한다.

## Tiptap Extension 구성 (106~124줄)

| Extension | 설정 |
| --- | --- |
| `StarterKit` | `hardBreak: false`로 내장 HardBreak 비활성 |
| `HardBreak.extend(...)` (111~117줄) | 키보드 단축키를 `Shift-Enter`로 재정의해 `setHardBreak()` 실행 — StarterKit 기본값과 분리해 커스터마이즈 |
| `Highlight.configure({ multicolor: true })` | 여러 하이라이트 색을 허용(다만 실제 `toggleHighlight` 호출은 `#fbca93` 고정) |
| `InlineMarkdownInputRules` (10~82줄) | 아래 표 참조 |

## `InlineMarkdownInputRules` (10~82줄)

타이핑 중(`addInputRules`)과 붙여넣기 시(`addPasteRules`) 모두에 동일한 7개 정규식을 적용해 마크다운 문법을 실시간으로 리치텍스트 마크로 변환한다.

| 패턴 | 마크 |
| --- | --- |
| `**text**` | bold |
| `__text__` | bold |
| `*text*` (앞뒤에 `*`가 연달아 오지 않는 경우, negative lookaround로 `**`와 구분) | italic |
| `_text_` | italic |
| `~~text~~` | strike |
| `` `text` `` | code |
| `==text==` | highlight |

input rule은 입력 커서 위치에서 끝나는 문자열(`$` 앵커)에 매치, paste rule은 붙여넣은 텍스트 전체(`g` 플래그)에 매치.

## 동기화 Effect

### 외부 → 내부 (163~167줄, deps `[content, editor]`)
`editor.getHTML() !== content`일 때만 `editor.commands.setContent(content, { emitUpdate: false })` — `emitUpdate: false`로 인해 이 프로그램적 갱신은 `onUpdate`(→`onChange`)를 다시 트리거하지 않는다(무한 루프 방지).

### 마운트 시 포커스 (169~175줄, deps `[editor]`)
`editor`가 준비되면 `setTimeout(..., 0)`으로 다음 이벤트 루프에서 `editor.commands.focus("end")` — 즉시 포커스하지 않고 한 틱 지연시킨다(마운트 직후 DOM/레이아웃이 안정되기 전 포커스 시도를 피하기 위한 것으로 추정).

## `handleEditorPointerUp` (177~186줄)

1. `event.preventDefault()` 항상 실행
2. `editor`가 없거나 포인터 타입이 `touch`/`mouse`가 아니면(예: `pen`) 종료
3. 에디터가 포커스돼 있지 않으면 `focus("end")` — **카드를 클릭해도 커서가 클릭한 위치가 아니라 항상 문서 끝으로 이동**한다(Tiptap 기본 클릭-커서 배치 동작을 이 핸들러가 덮어씀)

## 렌더 (188~194줄)

`<EditorContent className="h-full w-full" editor={editor} onPointerUp={handleEditorPointerUp} />` — 실제 contenteditable 영역의 클래스는 Tiptap이 `editorProps.attributes.class`로 지정한 `"memo-editor-content"`(127~129줄, 전역 CSS에서 타이포그래피 정의).

## 알려진 특이사항

- `handleEditorPointerUp`이 `pen` 포인터 타입을 명시적으로 제외한다 — Apple Pencil 등으로 메모를 클릭하면 이 강제 포커스 로직이 적용되지 않는다(드로잉 레이어의 펜 우선 처리와 일관된 설계 방향으로 보인다).
- "클릭 시 항상 문서 끝으로 포커스"는 의도된 단순화이지만, 문서 중간을 편집하려는 사용자가 클릭한 지점이 아니라 끝으로 커서가 이동하는 것을 예상하지 못할 수 있다.
- `toggleHighlight`의 색상이 코드에 하드코딩(`#fbca93`)돼 있어, `Highlight` extension이 `multicolor: true`로 설정된 것과 달리 실제로는 단일 색만 토글 가능하다.

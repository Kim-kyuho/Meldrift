# MemoCard 상세설계

소스: `components/MemoCard.tsx`, `hooks/useMemoCard.ts`

카드 리사이즈 최소 크기는 정식 Meldrift와 동일하게 `180 x 180`이다.

## MemoCard Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `memo` | `MemoCardData` | `useMemoCard`에 전달, `Rnd default/position/size` 초기값 |
| `zoom` | `number` | `Rnd scale` |
| `isEditing` | `boolean` | 편집/표시 마크업 분기(136줄), `Rnd disableDragging/enableResizing`, `MemoToolBar`/드래그 핸들 노출 |
| `isFocused` | `boolean` | `useMemoCard`에 전달 — 포커스 클래스(`memo-focused`, 106줄)와 바깥 클릭 시 포커스 해제 판정에 사용 |
| `onFocus`/`onFocusClear` | `() => void` | 카드 클릭 시 포커스 설정, 빈 보드 클릭 시 해제 |
| `onEditing`/`onEditingClear` | `() => void` | 편집 진입/종료 |
| `onInsert` | `(tempId, boardId, content, x, y, z, width, height, color) => void` | `saveMemo`가 `memo.id < 0`일 때 |
| `onUpdate` | 동일 시그니처 | 기존 메모일 때 |
| `onDelete` | `(id: number) => void` | `confirmDelete`에서 |
| `onBringToFront`/`onSendToBack` | `() => void` | `MemoToolBar`로 전달 |

## `useMemoCard` State (65~80줄)

| State | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `deleteDialogOpen` | `false` | `openDeleteDialog`/`confirmDelete`·`closeDeleteDialog` | `ConfirmDialog` 렌더 조건 |
| `dragHandlePressed` | `false` | 드래그 핸들 pointer 이벤트 4종(MemoCard.tsx 173~176줄) | 핸들 바 색상 |
| `memoState` | `{x,y, width: memo.width??300, height: memo.height??200}` | `handleDragStop`/`handleResizeStop` | `Rnd position/size` |
| `memoContent` | `memo.content` | `MemoEditor`의 `onChange={setMemoContent}` | 표시 모드의 `dangerouslySetInnerHTML`, 편집 모드의 `MemoEditor content` prop, 저장 payload |
| `memoColor` | `memo.color` | `MemoToolBar`의 `onChangeColor={setMemoColor}` | 카드 배경색(`backgroundColor: memoColor`), 저장 payload |
| `memoFocusRef` | `useRef(null)` | - | 편집 진입 시 포커스 대상 DOM(`editMemo`, 150~152줄) |
| `lastMemoTapRef` | `0` | `handleDoubleTap`마다 | 300ms 더블탭 판정 |
| `outsidePressStartedRef` | `false` | 전역 `pointerdown`/`pointerup` (170~224줄) | "빈 보드에서 시작해 빈 보드에서 끝난 press"만 저장 트리거로 인정 |

`memoState`/`memoContent`/`memoColor`는 `TableCard`/`MermaidCard`와 달리 **`useRef` 미러가 없다** — `saveMemo`(→`insertMemo`/`updateMemo`)는 `useCallback`의 클로저로 이 state들을 직접 참조하고, 의존성 배열에 모두 나열해(94~104, 119~129줄) 최신값을 보장한다(Ref 패턴 대신 의존성 배열 패턴을 쓰는 유일한 카드 훅).

## 저장: `insertMemo`/`updateMemo`/`saveMemo` (82~139줄)

- `insertMemo()`: `memo.id < 0`일 때 `onInsert(id, boardId, memoContent, round(x), round(y), memo.z, round(width), round(height), memoColor)`
- `updateMemo()`: 그 외에는 동일 인자로 `onUpdate(...)`
- `saveMemo()`: 위 둘 중 하나를 `memo.id` 부호로 분기 호출. `z`는 반올림하지 않고 원본 그대로(다른 카드들과 동일 패턴).

## 저장 트리거 (170~224줄)

`TableCard`/`MermaidCard`와 동일한 "빈 보드에서 시작 && 빈 보드에서 종료" 패턴(제외 셀렉터: `.board-toolbar`, `.memo-rnd-{id}`, 소속 판정은 `.board-scroll-layer`). 차이점:

- **포커스 해제 로직이 추가로 있다** (211~213줄): `isPressInsideEmptyBoard && isFocused`이면(편집 중이 아니어도) `onFocusClear()` 호출 — 빈 보드를 클릭하면 편집 저장과 별개로 "선택 해제"도 일어난다.
- `isPressInsideBoardToolBar`이면 조기 `return`(207~209줄)하여 포커스 해제 로직도 건너뛴다 — 툴바 클릭은 포커스에 영향을 주지 않는다.

## `editMemo()` (141~153줄)

1. `onEditing()` + `onFocus()` 동시 호출 — 편집 진입은 항상 포커스도 함께 설정
2. `setTimeout(..., 0)`으로 다음 틱에 `memoFocusRef.current?.focus()` — DOM이 편집 모드로 전환된 뒤 포커스를 주기 위한 지연

## 기타 핸들러

| 핸들러 | 동작 |
| --- | --- |
| `handleDoubleTap` (155~168줄) | 터치 + 300ms 이내 재탭 → `event.preventDefault()` 후 `editMemo()` (다른 카드의 `handleDoubleTap`과 달리 `preventDefault`를 호출한다) |
| `handleMemoPress` (226~228줄) | `onFocus()`만 호출 — `stopPropagation()`이 없다(다른 카드들의 `handle*Press`는 `stopPropagation`만 하고 포커스/이벤트 콜백이 없는 것과 반대) |
| `handleDragStop`/`handleResizeStop` | `TableCard` 등과 달리 `Ref` 동기화 없이 `setMemoState`만 호출(함수형 업데이트 사용, 231, 235줄) |
| `confirmDelete` (247~251줄) | `onDelete(id)` → `onEditingClear()` → `setDeleteDialogOpen(false)` |

## MemoCard 렌더 구조 (102~210줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| `Rnd` (104줄) | 항상 | 최소 크기 `180 x 180`. `className`에 `isEditing`이면 `card-editing`, 아니면 `isFocused`일 때만 `memo-focused` 추가(106줄) — **편집 중에는 focused 스타일이 적용되지 않는다** |
| 편집 모드 wrapper (137줄) | `isEditing` | `ref={memoFocusRef}`, `tabIndex={-1}`, `cursor:"text"`, 내부에 `MemoEditor` |
| 표시 모드 wrapper (153줄) | `!isEditing` | `onDoubleClick={editMemo}`, `onPointerDown={handleDoubleTap}`, 내부에 `dangerouslySetInnerHTML={{__html: memoContent}}`인 `div.memo-editor-content` |
| 드래그 핸들 (171줄) | `isEditing`일 때만 | 다른 카드들과 동일 패턴 |
| `MemoToolBar` (185줄) | `isEditing`일 때만 | 서식 콜백들이 전부 `memoEditorRef.current?.xxx()` 형태로 연결 |
| `ConfirmDialog` (201줄) | `deleteDialogOpen` | 메시지 "Delete this memo?" |

## `memoEditorRef` 연결 (100, 146, 184~198줄)

`MemoCard`가 `useRef<MemoEditorHandle>(null)`을 직접 소유(훅이 아니라 컴포넌트 레벨) → `MemoEditor`에 `ref`로 전달 → `MemoToolBar`의 각 서식 콜백(`onBold`, `onItalic` 등)이 `memoEditorRef.current?.toggleXxx()`를 호출하는 어댑터 역할을 한다. `onChangeColor`만 예외적으로 에디터가 아니라 `setMemoColor`(이 카드의 로컬 state)에 직접 연결된다.

## 알려진 특이사항

- `memoState`/`memoContent`/`memoColor`가 Ref 미러 없이 `useCallback` 의존성 배열로만 최신값을 보장하는 방식은 다른 카드 훅(Table/Image/Mermaid)의 "Ref 미러" 패턴과 다르다 — 동작은 동일하지만 이 프로젝트 안에 두 가지 스타일이 공존한다.
- 편집 중에는 `memo-focused` 클래스가 적용되지 않는다(106줄의 삼항 연산자가 `isEditing`을 우선시) — 시각적으로 "포커스됨"과 "편집 중"을 구분하려는 의도인지, 단순히 편집 중엔 `card-editing`이 이미 강조 스타일을 담당해서인지는 CSS 정의를 봐야 확정할 수 있다.
- 빈 보드 클릭 시 포커스 해제(`onFocusClear`)가 저장 로직과 같은 리스너 안에 있어, 저장 조건(`isEditing && ...`)이 거짓이어도 포커스 해제 조건은 별도로 평가된다 — 편집 중이 아닐 때 카드를 포커스한 상태에서 빈 보드를 클릭하면 포커스만 해제되고 저장은 애초에 대상이 없다.

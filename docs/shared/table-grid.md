# TableGrid 상세설계

소스: `packages/ui/src/features/table/TableGrid.tsx`, `packages/core/src/table-card.ts`
표 엔진: `@meldrift/table-engine` (`packages/ui` 의존성)

`TableGrid`는 React 어댑터다. 표의 DOM, 셀 선택·편집, 행·열 추가·삭제·이동, 크기 조절, 클립보드, IME 처리는 모두 엔진이 맡고, 이 컴포넌트는 엔진을 만들고 `source`·`isEditing`·`onChange`를 연결만 한다.

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `source` | `TableSource` | 마운트 시 엔진 `source` 옵션(31줄), 이후 바뀌면 `table.setSource`(52~55줄) |
| `isEditing` | `boolean` | 마운트 시 엔진 `editable` 옵션(32줄), 이후 바뀌면 `table.setEditable`(46~49줄) |
| `onChange` | `(source: TableSource) => void` | 엔진 `onChange`가 표 안에서 바뀐 값을 넘길 때 호출(33~36줄) |

## Ref

이 컴포넌트에는 `useState`가 없다. 표 상태는 엔진의 모델(`table.model`)이 가진다.

| Ref | 역할 |
| --- | --- |
| `containerRef` | 엔진이 표를 그리는 `div`(`h-full`) |
| `tableRef` | `createTable` 반환값(`setSource`, `setEditable`, `destroy` 등) |
| `sourceRef` / `isEditingRef` | 마운트 effect가 최신 값으로 엔진을 만들도록 보관 |
| `onChangeRef` | 최신 `onChange`. 엔진 콜백은 마운트 때 한 번만 넘기므로 ref로 최신 값을 참조한다(20~22줄) |

## Effect

| Effect | 의존성 | 동작 |
| --- | --- | --- |
| 20~22줄 | `[onChange]` | `onChangeRef` 갱신 |
| 24~44줄 | `[]` | `createTable(container, { source, editable, onChange })`로 엔진 생성, 언마운트 시 `table.destroy()` |
| 46~49줄 | `[isEditing]` | `table.setEditable(isEditing)` — 편집을 끝내면 엔진이 셀 선택과 체크한 행을 비운다 |
| 52~55줄 | `[source]` | `table.setSource(source)` — 엔진이 알린 값과 같은 객체면 엔진이 무시하므로, 실행 취소처럼 밖에서 바뀐 값만 다시 들어간다. 이때는 `onChange`가 다시 불리지 않는다 |

## 엔진이 제공하는 편집 기능

| 기능 | 조작 |
| --- | --- |
| 셀 선택 | 클릭, 드래그, Shift+클릭, 방향키, Tab, Ctrl(⌘)+A |
| 셀 편집 | 바로 입력, Enter, F2, 더블클릭. Shift+Enter로 셀 안 줄바꿈 |
| 열 이름 | 머리글 입력칸 |
| 행·열 추가 | 위쪽 `Row`·`Column` 버튼. 새 열 이름은 `Column {n}`, 너비는 첫 열 너비 |
| 행 삭제 | 체크박스로 고른 뒤 휴지통 버튼. 마지막 1행은 남는다 |
| 열 삭제 | 열 이름 옆 ×. 마지막 1열은 남는다 |
| 행·열 이동 | ⋮ 손잡이 드래그 |
| 열 너비·행 높이 | 머리글 오른쪽 경계, 행 왼쪽 칸 아래 경계 드래그 |
| 복사·붙여넣기 | Excel·Google Sheets와 TSV·HTML 표로 주고받음 |

버튼과 입력칸의 접근성 이름(`Row`, `Column`, `Column name`, `Select row`, `Delete selected rows`, `Delete {열 이름}`)은 엔진 기본값을 쓴다. 보드 확대·축소(`transform: scale`) 상태에서도 엔진이 포인터 이동 거리를 맞춰 계산한다.

편집 중이 아니면 엔진이 값만 보여 준다. `Row`·`Column` 버튼과 체크박스는 비활성이고, 열 이름은 글자로만 보이며, 이동 손잡이와 크기 조절 경계는 숨는다.

## 데이터 구조 (`packages/core/src/table-card.ts`)

```ts
type TableSource = {
    columns: Array<{ id: string; name: string; width?: number }>;               // min 1
    rows: Array<{ id: string; cells: Record<string, string>; height?: number }>; // min 1
};
```

- 엔진의 `TableSource`와 같은 모양이다. 행 높이(`height`)는 엔진에서 행 높이를 조절할 때 생기며, 없으면 최소 높이 37px을 쓴다.
- `tableSourceSchema`: Zod로 최소 컬럼 1개·행 1개를 강제한다. Free 보드 스냅샷과 Plus 변경분 검증이 이 스키마를 거치므로, 행 높이도 스키마에 있어야 저장 과정에서 지워지지 않는다.
- `createTableItemId()`: `Date.now().toString(36)-Math.random().toString(36)` 조합, 클라이언트에서 만드는 문자열 id.
- `tableSourceToMarkdown()`: `|`는 `\|`로, 개행은 `<br>`로 이스케이프한 GFM 표. Markdown 컴파일과 Plus Markdown 라우트가 사용한다.

## 스타일

- `packages/ui/styles/globals.css`가 엔진 `style.css`를 불러온다. 엔진 스타일의 색(머리글 `#f5f5f5`, 테두리 `#e5e5e5`, 체크한 행 `#f0f9ff` 등)과 버튼 모양은 기존 테이블 카드와 같게 만들어져 있다.
- 엔진은 열 너비를 스크롤 영역 너비에 맞춰 나누지만, 겹친 테두리(`border-collapse`) 1px만큼 표가 넓어져 가로 스크롤바가 생긴다. 표는 항상 카드 너비에 맞춰지므로 `globals.css`에서 `.meldrift-table-scroll`의 `overflow-x`를 `hidden`으로 둔다. 세로 스크롤은 셀 내용이 길어 행이 늘어날 때를 위해 남긴다.
- 체크박스 열 너비는 엔진의 `TABLE_SELECT_COLUMN_WIDTH`(40px)다. 카드 최소 크기는 [TableCard](./table-card.md#가용-영역과-최소-크기)에서 계산한다.

## 테스트

- `apps/free/tests/unit/TableGrid.test.tsx`: 초기 값 표시, 열 이름 변경 알림, 행·열 추가, 마지막 행·열 보존, 읽기 전용, 편집 모드 전환, 밖에서 바꾼 값 반영
- `apps/free/tests/e2e/table-card.spec.ts`: 셀 입력 저장, 최소 크기에서 스크롤바 없음, 행 높이 조절 후 새로고침해도 유지

## 알려진 특이사항

- 엔진에는 실행 취소 기능이 없다. 보드 실행 취소는 카드 단위로 편집 전후 상태를 되돌린다.
- 셀 편집은 표 전체에서 숨은 입력칸 하나를 선택한 셀 위로 옮겨 쓰는 방식이라, 셀마다 입력 요소가 있지 않다.

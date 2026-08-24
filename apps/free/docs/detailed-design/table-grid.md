# TableGrid 상세설계

소스: `components/TableGrid.tsx`, `hooks/useTableEdit.tsx`, `lib/table-card.ts`

## TableGrid Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `source` | `TableSource` | `useTableEdit`에 그대로 전달 (23줄) |
| `isEditing` | `boolean` | `useTableEdit`에 전달, 툴 영역 스타일 분기(27줄), 버튼 `disabled` 조건(31, 38, 47줄) |
| `onChange` | `(source: TableSource) => void` | `useTableEdit`에 전달 |

`TableGrid.tsx` 자체에는 `useState`/`useRef`가 없다 — 모든 상태는 `useTableEdit`가 소유한다.

## `useTableEdit` State (122~283줄)

| State | 타입/초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `sourceRef` | `useRef(source)`, 매 렌더 후 최신 `source`로 동기화 (129~131줄) | `useEffect([source])` | `updateCell`/`renameColumn`/`deleteColumn`/`addColumn`/`addRow`/`deleteSelectedRows` 전부가 최신 값을 읽기 위해 이 ref를 사용(클로저에 갇힌 stale `source` 방지) |
| `rowSelection` | `RowSelectionState`, `{}` (124줄) | `tableInstance.onRowSelectionChange`(233줄), `isEditing`이 false로 바뀌면 자동 초기화(134~137줄), `deleteSelectedRows` 성공 후 초기화(269줄) | `TableGrid`의 "선택 삭제" 버튼 노출 조건(43줄), `canDeleteSelectedRows` 계산 |
| `columnSizing` | `ColumnSizingState`, 초기값은 `source.columns`의 `width ?? 160` 맵 (125~127줄) | `tableInstance.onColumnSizingChange`(234줄, 헤더 드래그 리사이즈) | 컬럼 폭 변경 감지용 `useEffect`(139~154줄)가 이 값을 `column.width`와 비교 |

## 부수효과(Effect) 목록

| Effect | 의존성 | 동작 |
| --- | --- | --- |
| 129~131줄 | `[source]` | `sourceRef.current = source` |
| 133~137줄 | `[isEditing]` | `isEditing`이 false가 되는 순간 `setRowSelection({})` — 편집 모드를 벗어나면 선택 상태를 버림 |
| 139~154줄 | `[columnSizing, onChange]` | `columnSizing`과 현재 `source.columns`의 `width`를 반올림 비교해 다르면 `onChange`로 새 폭을 반영. **의존성 배열에 `sourceRef`나 `source`가 없어 `onChange`가 바뀌지 않는 한 이 effect의 클로저 안 `source` 비교 대상은 매 렌더 재평가되지만, effect 자체의 재실행 트리거는 `columnSizing` 변경 시점에 한정된다** |

## 핸들러 (156~270줄)

| 함수 | 동작 |
| --- | --- |
| `updateCell(rowId, columnId, value)` (156~165줄) | 해당 `rowId`의 `cells[columnId]`만 교체해 `onChange` 호출 |
| `renameColumn(columnId, name)` (167~174줄) | 해당 컬럼의 `name`만 교체해 `onChange` 호출 |
| `deleteColumn(columnId)` (176~188줄) | **컬럼이 1개뿐이면 조용히 return(삭제 거부)**. 아니면 해당 컬럼 제거 + 모든 행의 `cells`에서 그 컬럼 키 삭제 |
| `addColumn()` (241~248줄) | `createTableItemId()`로 새 id 생성, 이름 `Column {n+1}`, 폭 160, 모든 기존 행에 빈 문자열 셀 추가 |
| `addRow()` (250~259줄) | 새 행 id 생성, 현재 컬럼 목록 기준으로 빈 문자열 셀 채운 행 추가 |
| `deleteSelectedRows()` (261~270줄) | 선택된 행 id 집합을 `tableInstance.getSelectedRowModel()`에서 구해 제외. **남는 행이 0개면 조용히 return(전체 삭제 거부)**. 성공 시 `onChange` + `setRowSelection({})` |

## 파생 값

- `columnStructureKey` (190~192줄): `id:width` 페어를 이어붙인 문자열. `columns` `useMemo`(194~215줄)의 유일한 의존성 — 셀 값이나 열 이름이 바뀌어도 이 키가 그대로면 컬럼 정의 객체를 재생성하지 않아 **입력 중 포커스 손실을 방지**한다(213줄 주석).
- `canDeleteSelectedRows` (273줄): `source.rows.length - selectedRowCount >= 1` — 선택 삭제 후 최소 1행이 남는지 미리 계산해 버튼 `disabled`에 사용(48줄).

## 렌더 구조 (`TableGrid.tsx` 25~102줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| Row 추가 버튼 (29줄) | 항상 노출, `disabled={!isEditing}` | 아이콘 `Plus` |
| Column 추가 버튼 (36줄) | 항상 노출, `disabled={!isEditing}` | 아이콘 `Plus` |
| 선택 삭제 버튼 (44줄) | `Object.keys(rowSelection).length > 0`일 때만 노출, `disabled={!isEditing \|\| !canDeleteSelectedRows}` | 아이콘 `Trash2`, `text-rose-600` |
| `<thead>` 헤더 셀 (62줄) | `isEditing && header.column.getCanResize()`일 때만 리사이즈 핸들(72줄) 노출 | 폭은 `getSize()/getTotalSize()`의 퍼센트로 계산 |
| `<tbody>` 행 (84줄) | `row.getIsSelected()`면 `bg-sky-50`, 아니면 `bg-white` | - |

## 셀/헤더 서브컴포넌트 (`useTableEdit.tsx` 32~120줄)

| 컴포넌트 | 편집 모드 | 비편집 모드 |
| --- | --- | --- |
| `SelectHeader` (32~45줄) | 전체 선택 체크박스, `disabled={!meta.isEditing}` | 동일 마크업이지만 checkbox `disabled` |
| `SelectCell` (47~60줄) | 행 선택 체크박스 | 동일, `disabled` |
| `TableColumnHeader` (62~92줄) | `<input>`으로 컬럼명 수정 + (컬럼이 2개 이상일 때만) 삭제 `X` 버튼 | `<span>` 표시 전용 |
| `TableColumnCell` (94~120줄) | `<textarea>`, `useLayoutEffect`(99~106줄)로 `scrollHeight`에 맞춰 높이 자동 조절 | `<span className="whitespace-pre-wrap wrap-break-words">` |

## 데이터 구조 (`lib/table-card.ts`)

```ts
type TableSource = {
    columns: Array<{ id: string; name: string; width?: number }>; // min 1
    rows: Array<{ id: string; cells: Record<string, string> }>;   // min 1
};
```

- `tableSourceSchema`(14~17줄): Zod로 최소 컬럼 1개·행 1개 강제 — `deleteColumn`/`deleteSelectedRows`의 "마지막 하나는 거부" 런타임 로직과 스키마 제약이 이중으로 일치해야 한다.
- `createTableItemId()`(21~22줄): `Date.now().toString(36)-Math.random().toString(36)` 조합, DB 시퀀스가 아닌 클라이언트 생성 문자열 id.
- `tableSourceToMarkdown()`: `|`는 `\|`로, 개행은 `<br>`로 이스케이프한 뒤 GFM 표 문자열 생성 — `lib/board-markdown.ts`가 이 함수를 사용한다.

## 알려진 특이사항

- 정렬/필터/그룹/페이지네이션 없음 — `getCoreRowModel()`만 사용.
- `deleteColumn`과 `deleteSelectedRows` 모두 "실패 시 에러를 던지지 않고 조용히 return"하는 방식이라, UI에서 버튼이 `disabled`로 막히지 않는 경로(예: 외부에서 직접 호출)로 들어오면 아무 피드백 없이 무시된다.

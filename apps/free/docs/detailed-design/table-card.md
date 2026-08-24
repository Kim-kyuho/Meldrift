# TableCard 상세설계

소스: `components/TableCard.tsx`, `hooks/useTableCard.ts`

## TableCard Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `table` | `BoardTable` | `useTableCard`에 전달, `Rnd` 초기 위치/크기 소스 |
| `zoom` | `number` | `Rnd scale={zoom}` (77줄) |
| `isEditing` | `boolean` | `Rnd`의 `disableDragging`/`enableResizing`(79~80줄), 드래그 핸들 노출(94줄), 툴바 노출(109줄) |
| `onEditing` | `() => void` | `useTableCard.editTable`이 호출 |
| `onEditingClear` | `() => void` | 외부 클릭 저장 완료 후(useTableCard), 삭제 확정 후(`confirmDelete`) |
| `onInsert` | `(table: BoardTable) => void` | `saveTable`에서 `table.id < 0`(신규)일 때 |
| `onUpdate` | `(table: BoardTable) => void` | `saveTable`에서 기존 행일 때 |
| `onDelete` | `(id: number) => void` | `confirmDelete`에서 호출 |
| `onBringToFront` / `onSendToBack` | `() => void` | `TableToolBar`에 그대로 전달 |

## `useTableCard` State (29~180줄)

| State/Ref | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `source` | `table.source` | `TableGrid`의 `onChange={setSource}` | `TableGrid source` prop, `sourceRef` 동기화 |
| `cardState` | `{x,y,width,height} = table.*` | `handleDragStop`, `handleResizeStop` | `Rnd position/size` |
| `dragHandlePressed` | `false` | 드래그 핸들 `onPointerDown/Up/Cancel/Leave` (TableCard.tsx 97~100줄) | 핸들 바 색상(진하게/연하게) |
| `deleteDialogOpen` | `false` | `openDeleteDialog`(true) / `closeDeleteDialog`·`confirmDelete`(false) | `ConfirmDialog` 렌더 조건 |
| `sourceRef` / `cardStateRef` | 각 state의 미러 | 대응 `useEffect`가 렌더 후 동기화 (44~50줄) | `saveTable`이 최신값을 읽기 위해 사용(클로저 stale 방지) |
| `lastTapRef` | `0` | `handleDoubleTap`마다 `event.timeStamp` 기록 | 300ms 이내 재탭이면 더블탭으로 간주 |
| `outsidePressStartedRef` | `false` | 전역 `pointerdown`/`pointerup` 리스너 (88~124줄) | 빈 보드에서 시작해 빈 보드에서 끝난 press인지 판정 |

## 저장 트리거: 빈 보드 바깥 클릭 감지 (87~133줄)

문서 전역에 `pointerdown`/`pointerup` 리스너를 건다(카드별로 매번 등록/해제, deps: `[isEditing, onEditingClear, saveTable, table.id]`).

- `pointerdown` 시점: 클릭 대상이 `.board-scroll-layer` 안이면서 `.table-rnd-{table.id}`, `.board-toolbar`, `.confirm-dialog` **어디에도 속하지 않으면** `outsidePressStartedRef = true`
- `pointerup` 시점: 같은 조건을 다시 검사해 "빈 보드에서 시작 && 빈 보드에서 종료"이고 `isEditing`이면 → `saveTable()` + `onEditingClear()`
- 즉 카드 안에서 누르기 시작해 카드 밖으로 드래그해서 뗀 경우(또는 그 반대)는 저장이 발생하지 않는다 — 의도적으로 "완전히 빈 보드에서 일어난 클릭"만 저장 트리거로 인정.

## `saveTable()` (52~69줄)

1. `cardStateRef.current`와 `sourceRef.current`로 `nextTable: BoardTable` 조립, 좌표/크기는 `Math.round`
2. `table.id < 0` → `onInsert(nextTable)` (신규 미저장 카드)
3. 그 외 → `onUpdate(nextTable)`

## 기타 핸들러

| 핸들러 | 동작 |
| --- | --- |
| `editTable()` (71~77줄) | `onEditing()`을 호출해 바로 편집 시작 |
| `handleDoubleTap` (79~85줄) | `event.pointerType !== "touch"`면 무시. 터치이고 이전 탭과 300ms 미만이면 `editTable()` 호출(더블탭으로 편집 진입) |
| `handleTablePress` (135~137줄) | `event.stopPropagation()`만 수행 — 보드 레벨 클릭 핸들러로 이벤트가 전파되는 것을 차단 |
| `handleDragStop` (139~143줄) | `Rnd`가 준 `{x, y}`로 `cardState` 갱신 |
| `handleResizeStop` (145~154줄) | `Rnd`가 준 `ref.offsetWidth/Height`와 `position`으로 `cardState` 갱신 |
| `confirmDelete` (156~160줄) | `onDelete(table.id)` → `onEditingClear()` → `setDeleteDialogOpen(false)` 순서로 실행 |

## TableCard 렌더 구조 (68~126줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| `Rnd` (70줄) | 항상 | `className="table-rnd-{table.id} ..."`, `zIndex: isEditing ? ACTIVE_CARD_Z : table.z`, `bounds="parent"`, `dragHandleClassName="table-drag-handle"`, `disableDragging={!isEditing}`, `enableResizing={isEditing}`, `minWidth=360`, `minHeight=128` |
| 내부 wrapper `div` (86줄) | 항상 | `overflow-hidden` — 표 스크롤은 `TableGrid` 내부(`overflow-auto`)가 담당, `onClick`(stopPropagation), `onDoubleClick={editTable}`, `onPointerDown={handleDoubleTap}` |
| `TableGrid` (92줄) | 항상 렌더(편집 여부 무관) | `isEditing`에 따라 내부 표시만 전환(레이아웃 크기 변화 방지) |
| 드래그 핸들 바 (95줄) | `isEditing`일 때만 | 하단 중앙, `cursor-grab`/`active:cursor-grabbing`, 눌림 상태에 따라 `bg-black/70` ↔ `bg-black/25` |
| `TableToolBar` (110줄) | `isEditing`일 때만 | `onDelete={openDeleteDialog}` — 즉시 삭제가 아니라 확인 다이얼로그를 연다 |
| `ConfirmDialog` (117줄) | `deleteDialogOpen`일 때만 | 메시지 "Delete this table?", `onConfirm={confirmDelete}`, `onCancel={closeDeleteDialog}` |

## 알려진 특이사항

- 카드 이동은 반드시 `.table-drag-handle`(하단 바)에서만 시작된다 — 표 영역을 직접 드래그해도 카드가 움직이지 않는다(shell 자체의 `disableDragging`은 `dragHandleClassName`으로 시작점이 제한됨).
- 전역 `pointerdown`/`pointerup` 리스너가 테이블 카드 인스턴스마다 하나씩 등록된다 — 보드에 표 카드가 많으면 그만큼 리스너도 늘어난다(다른 카드 타입, 예: `useMemoCard`도 유사 패턴을 쓰는지 비교 확인 필요 시 해당 문서 참조).

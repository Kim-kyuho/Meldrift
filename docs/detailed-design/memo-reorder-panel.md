# MemoReorderPanel 상세설계

소스: `components/MemoReorderPanel.tsx`, `hooks/useMemoReorder.ts`, `lib/memo-order.ts`, `app/api/memos/order/route.ts`

## 역할

보드의 메모를 순서대로 한 줄씩 세우고, 손잡이를 끌어 그 순서를 바꾼다. 여기서 정한 순서는 `BoardNavigator`의 연번, `BoardSearchPanel`의 결과 순회 차례, 그리고 Markdown 문서 순서에 쓰인다. 문서 순서를 바꾸는 곳은 여기뿐이다 — 카드를 보드에서 옮기거나 AI가 재배치해도 바뀌지 않는다.

`BoardMenu`의 `Reorder Memos` 항목으로 열고 닫는다.

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `memos` | `BoardMemo[]` | 이미 정렬된 목록. 끄는 동안에는 놓을 자리로 옮겨 둔 미리보기가 들어온다 |
| `listRef` | `RefObject<HTMLDivElement \| null>` | 포인터 위치를 줄 번호로 바꿀 때 기준이 되는 스크롤 컨테이너 |
| `draggingMemoId` | `number \| null` | 끌고 있는 줄의 강조와 `translateY` 적용 대상 |
| `dragOffsetY` | `number` | 놓일 자리에서 손가락까지의 거리(px) |
| `onDragStart` | `(event, memoId) => void` | 손잡이 `onPointerDown` |
| `onRowClick` | `(memoId: number) => void` | 줄 `onClick` — 끌지 않았을 때만 그 메모로 이동 |
| `onClose` | `() => void` | 닫기 버튼 |

## State

없음 — 패널 열림, 끌기 상태, 순서 저장은 모두 `useMemoReorder`가 소유한다.

## 렌더 구조

| 요소 | 스타일/속성 | 비고 |
| --- | --- | --- |
| 루트 `div` | `board-toolbar fixed left-5 top-20`, `z-50000`, `w-72`, `bg-white/75 rounded-xl shadow-md` | `.board-toolbar`라서 카드의 외부 저장 판정에서 제외된다 |
| 목록 `div` | `maxHeight = memoReorderRowHeight * memoReorderVisibleRows`, `overflow-y-auto` | 줄 높이의 정확한 배수라 다음 줄이 반쯤 걸쳐 보이지 않는다 |
| 줄 `div` | `memo-order-row`, 높이 `memoReorderRowHeight` | 끌고 있는 줄만 `translateY` + `position: relative` + `z-index: 10` |
| 손잡이 `span` | `role="button"`, `aria-label="Move memo N"`, `touch-action: none` | 여기서 시작한 터치만 끌기로 쓴다 |
| 연번 `span` | `w-5 text-center` | 배열 위치 + 1. 저장된 `sort_order` 값이 아니다 |
| 색 점 `span` | `h-3 w-3 rounded-full` | 메모 배경색 |
| 본문 `button` | `truncate` | HTML을 걷어낸 한 줄. 비어 있으면 `(empty memo)` |

`memoReorderRowHeight`(44)는 CSS의 줄 높이이면서 포인터 위치를 줄 번호로 바꾸는 나눗셈의 분모다. 둘 중 하나만 바꾸면 끌기 위치가 어긋난다.

## 끌기

- 4px 임계값을 넘지 않고 끝난 입력은 끌기가 아니라 누른 것으로 보고 그 메모를 포커스한다. `draggedRef`는 다음 `pointerdown`까지 유지해서, 끌고 난 뒤 따라오는 `click`이 메모 이동으로 새는 것을 막는다.
- `pointermove`와 `pointerup`은 `window`에서 듣는다. 줄에 `setPointerCapture`를 걸면 미리보기로 DOM 순서가 바뀔 때 캡처를 잃을 수 있고, 패널 밖으로 나간 뒤의 입력도 놓친다.
- 잡은 지점이 손가락에 붙도록 `grabOffsetRef`에 줄 안에서의 세로 위치를 기록하고 매 이동에서 빼 준다.
- 놓을 자리는 줄의 위쪽 끝을 기준으로 `Math.round(top / memoReorderRowHeight)`로 정한다. 포인터 위치가 아니라 줄 위치를 쓰므로 화면에 보이는 것과 판정이 같다.
- 끌고 있는 줄이 목록 밖으로 나가지 않도록 위치를 `0..(N-1) * 줄 높이`로 자른다.
- 편집 권한이 없으면 끌기를 시작하지 않고 권한 메시지를 표시한다. 저장 전 임시 카드는 음수 ID라 순서를 바꿀 수 없다.

## 순서 저장

순서 값은 서버가 정한다. 클라이언트는 옮길 메모와 놓을 자리만 보낸다.

```text
POST /api/memos/order   { boardId, memoId, targetIndex }
                    ->  { ok, memos: [{ id, sortOrder }] }
```

화면은 놓는 즉시 바꾸고 요청은 그 뒤에 보낸다. 응답을 기다렸다가 반영하면 놓은 줄이 잠깐 원래 자리로 돌아갔다가 다시 움직인다. 화면과 서버가 같은 `reorderMemos`로 계산하므로 성공하면 두 결과가 같다.

1. 옮긴 결과를 화면에 먼저 적용하고, 되돌릴 때 쓸 이전 `sortOrder`를 id별로 들고 있는다.
2. 서버가 편집 권한을 확인한다. `getCardPermissionMessage`가 메시지를 돌려주면 403이다.
3. 서버가 보드의 메모를 `sort_order`, `id` 순으로 조회한다. 클라이언트가 보낸 순서 값은 요청에 들어 있지도 않다.
4. `reorderMemos`가 새 `sort_order`를 계산한다.
5. 바뀐 행만 모아 `UPDATE ... FROM (VALUES ...)` 한 문장으로 쓴다.
6. 클라이언트가 응답 값으로 화면을 맞춘다. 서버가 거절하거나 요청이 실패하면 1에서 들고 있던 값으로 되돌린다.

되돌릴 때는 `sortOrder`만 되돌린다. 그 사이에 바뀐 본문이나 좌표는 건드리지 않는다.

재정렬 한 번에 조회 1회, 쓰기 1회다. 자리가 그대로면 쓰기를 아예 하지 않는다.

### reorderMemos

옮기는 메모의 `sort_order`를 목적지 값으로 바꾸고, 원래 자리와 목적지 사이에 낀 메모만 +1 또는 -1 한다. 나머지 메모는 건드리지 않으므로 전체를 다시 매기지 않는다.

- 화면에서 위로 올라가는 것은 `sort_order` 값이 작아지는 쪽이다. 코드에서는 `toSmallerOrder`라는 값 기준 이름을 쓴다.
- 삭제로 생긴 빈 번호가 있어도 상대 순서만 보므로 결과가 같고 값의 유일성도 유지된다.
- 배열 순서는 그대로 두고 `sortOrder`만 바꾼다.

## 순서 값의 출처

| 시점 | 값 |
| --- | --- |
| 마이그레이션 | 보드마다 `ROW_NUMBER() OVER (PARTITION BY board_id ORDER BY id)` |
| 새 메모 | 그 보드의 `MAX(sort_order) + 1` (서버가 INSERT에서 매긴다) |
| 임시 카드 | 화면에서 `nextMemoOrder(memos)`. 저장하면 서버 값으로 교체된다 |
| 재정렬 | `POST /api/memos/order`의 계산 결과 |

`(board_id, sort_order)` 인덱스를 둔다. 재정렬은 보드 하나의 구간만 읽고 쓴다.

## Free Edition과의 차이

화면 동작과 `lib/memo-order.ts`의 계산은 두 에디션이 같다. 저장 경로만 다르다.

| | Free | Plus |
| --- | --- | --- |
| 순서 계산 | 브라우저 | 서버 |
| 저장 | 스냅샷 자동 저장(150ms 디바운스) | `POST /api/memos/order` |
| 실패 시 | 저장 실패 메시지 | 화면 순서를 되돌리고 메시지 |
| 권한 | 없음 | 로그인 + 관리자 승인 |
| 불러올 때 | `rankMemoOrders`로 1..N 재번호 | DB 값 그대로 |

Free는 순서 컬럼이 없던 시절의 저장 파일을 열 수 있어야 해서 불러올 때 다시 매긴다. Plus는 마이그레이션이 값을 채워 두므로 그럴 일이 없다.

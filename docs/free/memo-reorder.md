# 메모 순서 변경 상세설계 (Free)

소스: `hooks/useMemoReorder.ts`

순서 패널 자체(`packages/ui/src/components/MemoReorderPanel.tsx`)와 순서 계산(`packages/ui/../@meldrift/core/memo-order`의 `reorderMemos`, `sortMemosByOrder`, `memoReorderRowHeight`)은 두 Edition이 공유한다. 아래는 Free만 다른 부분이다.

## Plus와 갈리는 지점

Plus는 놓는 순간 화면을 먼저 바꾸고 `POST /api/memos/order`를 부른 뒤, 실패하면 순서 값만 되돌린다. Free에는 그 왕복이 없다.

| | Plus | Free |
| --- | --- | --- |
| 입력 | `boardId`, `canEditCard`, `showPermissionMessage`, `setPermissionMessage` 포함 | `memos`, `setMemos`, `onFocusMemo` 셋 |
| 저장 | `saveMemoOrder`가 서버에 POST | 없다. `setMemos`만 |
| 낙관적 반영 | `applyMemoOrder`로 화면 선반영 후 응답 대조 | 반영이 곧 결과다 |
| 롤백 | 실패 시 이전 순서로 되돌림 | 롤백 대상이 없다 |
| 권한 | 편집 권한이 없으면 시작하지 않음 | 없다 |

Free에서 순서는 `snapshot.memos`의 `sortOrder`로 들어가 자동 저장에 함께 실린다.

## 상태

| 값 | 초기값 | 역할 |
| --- | --- | --- |
| `reorderOpen` | `false` | 패널 열림 |
| `draggingMemoId` | `null` | 끌고 있는 메모 |
| `dropIndex` | `null` | 놓일 줄 번호 |
| `dragOffsetY` | `0` | 끌리는 줄의 시각적 어긋남 |
| `reorderListRef` | `null` | 목록 컨테이너 |
| `dragStartYRef` / `grabOffsetRef` / `draggedRef` | - | 시작 지점, 잡은 위치, 실제로 끌었는지 |

## 좌표 계산

`getContentY(clientY)`가 포인터 위치를 목록 내부 좌표로 바꾸고, `getDragPosition`이 이를 줄 번호와 잔여 오프셋으로 나눈다.

```text
index   = 목록 범위로 자른 뒤 memoReorderRowHeight로 나눈 값
offsetY = clampedTop - index * memoReorderRowHeight
```

`memoReorderRowHeight`(44)는 CSS의 줄 높이와 반드시 같아야 한다. 포인터 위치를 줄 번호로 바꾸는 기준이기 때문이다.

## 끌기

`handleReorderStart`에서 포인터를 잡고 `document`에 이동·종료 리스너를 붙인다.

- 이동: `getDragPosition`으로 `dropIndex`와 `dragOffsetY`를 갱신하고 `draggedRef`를 세운다.
- 종료: `setMemos((prev) => reorderMemos(prev, draggingMemoId, position.index))`로 순서를 확정하고 끌기 상태를 초기화한다.

`draggedRef`가 서지 않은 채 끝나면 클릭으로 본다. `handleRowClick`이 `onFocusMemo`를 불러 해당 메모로 보드를 이동시킨다.

## 반환값

`reorderOpen`, `draggingMemoId`, `dropIndex`, `dragOffsetY`, `reorderListRef`와 핸들러(`handleToggleReorderPanel`, `handleCloseReorderPanel`, `handleReorderStart`, `handleRowClick`)를 돌려준다. `MemoReorderPanel`이 이 값을 그대로 받는다.

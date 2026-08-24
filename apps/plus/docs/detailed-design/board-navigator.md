# BoardNavigator 상세설계

소스: `components/BoardNavigator.tsx`, `hooks/useBoardMemoFocus.ts`

## 역할

보드의 메모를 ID 오름차순으로 정렬한 뒤, 좌우 이동 또는 연번 입력으로 해당 메모를 화면 중앙에 포커스한다.

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `currentMemoNumber` | `number` | `focusedMemoOrder`에서 전달받은 1부터 시작하는 현재 메모 순서 |
| `memoCount` | `number` | 전체 메모 수 표시 |
| `onPrev` / `onNext` | `() => void` | 기존 이전·다음 메모 포커스 핸들러 |
| `onMemoNumberChange` | `(memoNumber: number) => void` | 입력된 연번으로 즉시 이동 |

## 렌더 구조

- 검색 패널과 같은 `fixed bottom-20 left-1/2` 위치에 표시한다.
- 구성은 `ChevronLeft`, 메모 연번 input, `/ 전체 메모 수`, `ChevronRight` 순서다.
- input은 숫자 이외의 문자를 제거하고 값이 존재하면 즉시 `onMemoNumberChange`를 호출한다.
- `currentMemoNumber`가 변경되면 input의 `key`도 변경되어 실제 포커스 연번으로 표시값이 갱신된다.

## 연번 이동

`useBoardMemoFocus.focusMemoByOrder`가 입력값을 검증한다.

- 유효 범위: `1..memoCount`
- 유효한 경우: `sortedMemoIds[memoNumber - 1]`을 `focusMemoById`에 전달
- 유효하지 않은 경우: 포커스를 유지하고 `Memo does not exist.` 메시지 표시

# CreateBoardModal 상세설계

소스: `components/CreateBoardModal.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `ownerId` | `string \| null` | POST body의 `ownerId` (48줄) |
| `onClose` | `() => void` | 오버레이 클릭(66줄), X 버튼(76줄), Cancel 버튼(126줄) |
| `onCreated` | `(boardId: number) => void` | 생성 성공 시 `data.board.boardId` 전달 (58줄) |

## 상수: `boardSizeOptions` (15~23줄)

| label | width | height |
| --- | --- | --- |
| "7680 x 4320" | 7680 | 4320 |
| "3840 x 2160" | 3840 | 2160 (기본 선택값, `<select defaultValue>` 107줄) |
| "1920 x 1080" | 1920 | 1080 |
| "4320 x 7680" | 4320 | 7680 |
| "2160 x 3840" | 2160 | 3840 |
| "1080 x 1920" | 1080 | 1920 |

가로형 3개(16:9 계열)와 그 폭/높이를 뒤집은 세로형 3개로 구성 — 이 6개 문자열 외의 값은 허용되지 않는다.

## State

| State | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `errorMessage` | `""` | 제목 미입력(31줄), 크기 미선택(35줄), API 실패(54줄) 세 지점에서 각각 다른 메시지로 설정 | `<BoardMessage type="error">` (116줄), 3500ms 후 `onDismiss`가 `""`로 초기화 |

## 핸들러: `handleCreateBoard(title, sizeValue)` (28~59줄)

1. `boardSizeOptions`에서 `label === sizeValue`인 옵션 조회
2. `!title.trim()` → "Please enter a board title." 설정 후 종료
3. `!selectedSize` → "Please select a board size." 설정 후 종료 (사실상 `<select>`가 항상 유효한 label을 보내므로 정상 흐름에서는 도달하기 어려운 방어 코드)
4. `POST /api/boards` with `{ title: title.trim(), width, height, ownerId }`
5. `data.ok === false` → `data.message ?? "Board could not be created."` 설정 후 종료
6. 성공 → `onCreated(data.board.boardId)`

## 폼 제출 흐름 (82~91줄)

1. `event.preventDefault()`
2. `FormData`에서 `title`, `size` 추출
3. `handleCreateBoard(title, size)` 호출

## 렌더 구조 / z-index

| 요소 | z-index | 비고 |
| --- | --- | --- |
| 오버레이 (63줄) | 70 | 클릭 시 `onClose` |
| 패널 (68줄) | 80 | `w-[min(24rem,calc(100vw-2rem))]` |
| Title input (95줄) | - | `required`, 초기값 없음(빈 문자열 시작) |
| Board size `<select>` (104줄) | - | `defaultValue="3840 x 2160"` |
| 에러 메시지 (116줄) | - | `errorMessage`가 있을 때만 |
| Cancel / Create 버튼 (123, 130줄) | - | `type="button"` / `type="submit"` |

## 알려진 특이사항

- `RenameBoardModal`과 z-index(70/80), 레이아웃 클래스, 오버레이·닫기 버튼 구조가 동일하다. 두 컴포넌트는 각각 문맥에 맞는 닫기 버튼 `aria-label`을 사용한다.
- fetch 자체가 실패(네트워크 오류)하는 경우에 대한 처리가 없다 — 다른 모달들과 동일한 패턴의 공백.

# RenameBoardModal 상세설계

소스: `components/RenameBoardModal.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `boardId` | `number` | PATCH 요청 경로(`/api/boards/{boardId}`) 및 body의 `boardId` (21, 27줄) |
| `title` | `string` | input의 `defaultValue` 초기값 (78줄) |
| `onClose` | `() => void` | 오버레이 클릭(46줄), X 버튼(56줄), Cancel 버튼(93줄) 3곳에서 호출 |
| `onRenamed` | `(boardId: number, title: string) => void` | PATCH 성공 시 `data.board.boardId`, `data.board.title`을 그대로 전달 (38줄) |

## State

| State | 타입/초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `errorMessage` | `string`, `""` | PATCH 응답 `data.ok`가 false일 때 `data.message ?? "Board could not be renamed."`로 설정 (34줄) | `<BoardMessage type="error" message={errorMessage} />`가 렌더링 (83줄). 값이 빈 문자열이면 BoardMessage는 미표시(BoardMessage 자체 로직) |

## 핸들러: `handleRenameBoard(title: string)` (20~39줄)

1. `fetch(PATCH /api/boards/{boardId})`, body: `{ boardId, title: title.trim() }`
2. 응답 JSON 파싱
3. `data.ok === false` → `setErrorMessage(...)` 후 `return` (여기서 종료, `onRenamed` 호출 안 됨)
4. `data.ok === true` → `onRenamed(data.board.boardId, data.board.title)` 호출, 모달은 스스로 닫지 않음(닫기는 부모가 `onRenamed` 콜백 안에서 처리한다고 가정)

## 폼 제출 흐름 (62~71줄)

1. `<form onSubmit>` → `event.preventDefault()`
2. `FormData(event.currentTarget)`에서 `title` 필드 추출 (`formData.get("title")`)
3. `handleRenameBoard(title)` 호출 (에러 발생 시 catch 없음 — fetch 자체가 reject되는 케이스는 처리하지 않음)

## 렌더 구조 / z-index

| 요소 | 조건 | z-index | 비고 |
| --- | --- | --- | --- |
| 오버레이 `div` (44줄) | 항상 렌더 | 70 | 클릭 시 `onClose` |
| 모달 패널 `div` (48줄) | 항상 렌더 | 80 | `fixed left-1/2 top-1/2`로 중앙 고정, `-translate-x/y-1/2` |
| 제목 `h2` | 항상 | - | 텍스트 "Rename board" 고정 |
| 닫기 버튼 (54줄) | 항상 | - | `aria-label="Close rename board modal"` |
| `input[name=title]` (74줄) | 항상 | - | `defaultValue={title}`, `required`, 비제어 컴포넌트(uncontrolled) — 리렌더링돼도 `title` prop이 다시 반영되지 않음 |
| `BoardMessage` (83줄) | `errorMessage`가 truthy일 때만 실질적으로 보임 | - | error 타입 고정, `onDismiss`로 3500ms 후 자동 초기화 |
| Cancel 버튼 (90줄) | 항상 | - | `type="button"`, `onClose` 호출 |
| Rename 버튼 (97줄) | 항상 | - | `type="submit"` |

## 외부 의존성

- `createPortal(..., document.body)` — 모달을 DOM 트리 최상위에 렌더링
- `PressableButton`, `BoardMessage` 컴포넌트 재사용
- CreateBoardModal과 레이아웃/전이 스타일이 동일 (같은 클래스 문자열, 같은 z-index 70/80)

## 알려진 특이사항 (코드 그대로 기술, 개선 제안 아님)

- fetch 실패(네트워크 에러) 시 별도 처리 없이 unhandled rejection이 됨 — `errorMessage`는 갱신되지 않음.
- PATCH 성공 후 모달 자체를 닫는 로직이 이 컴포넌트 안에는 없음(부모의 `onRenamed` 구현에 위임).

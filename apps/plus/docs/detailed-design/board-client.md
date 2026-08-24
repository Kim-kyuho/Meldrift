# BoardClient 상세설계

소스: `app/boards/[boardId]/page.tsx`, `components/BoardClient.tsx`

보드 화면의 클라이언트 루트다. 서버가 조회한 보드·카드·드로잉 데이터를 도메인 훅에 전달하고, 각 훅의 상태와 핸들러를 화면 컴포넌트에 연결하는 조정 허브다.

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `currentBoard` | `{boardId, title, width, height}` | 보드 크기, 메뉴, API 대상 ID |
| `mappedImages` | `Image[]` | `useBoardImages.initialImages` |
| `mappedMemos` | `Memo[]` | `useBoardMemos.initialMemos` |
| `mappedMermaids` | `Mermaid[]` | `useBoardMermaids.initialMermaids` |
| `mappedTables` | `Table[]` | `useBoardTables.initialTables` |
| `mappedStrokes` | `BoardStroke[]` | `useBoardDrawing.initialStrokes` |

`app/boards/[boardId]/page.tsx`가 DB 행의 필드명을 화면 모델로 매핑해 전달한다. URL의 `boardId`가 양의 정수가 아니거나 보드 조회 결과가 없으면 `notFound()`를 호출하며, 이 경우 카드·드로잉 조회와 `BoardClient` 렌더링은 실행하지 않는다.

## 로컬 State/Ref

| State/Ref | 초기값 | 역할 |
| --- | --- | --- |
| `cardLocationRef` | `null` | `.board-scroll-layer` DOM Ref. 카드 중앙 배치, 패닝, 미리보기 캡처가 공유한다. |
| `menuOpen` | `false` | `BoardMenu` 표시 상태 |
| `aboutOpen` | `false` | `AboutModal` 표시 상태, `BoardMenu`의 `onAbout`으로 설정 |
| `markdownViewOpen` | `false` | `BoardMarkdownView` 표시 상태 |
| `boardNavigatorOpen` | `false` | `BoardNavigator` 표시 상태, `BoardToolBar`가 토글 |
| `permissionMessage` | `""` | 인증·권한·카드 API 오류 메시지 |

`showPermissionMessage()`는 로그인 사용자가 있으면 관리자 승인 대기, 없으면 로그인 필요 메시지를 설정한다.

## 조립하는 훅

| 훅 | 소유 영역 | BoardClient 연결점 |
| --- | --- | --- |
| `useBoardPreview` | 뷰포트 캡처와 업로드 예약 | `cardLocationRef`, 카드·드로잉 저장 성공 콜백 |
| `useBoardZoom` | 보드 확대율 | 카드 `scale`, 좌표 계산, 줌 UI |
| `useBoardAuth` | 사용자와 인증 모달 | 권한 플래그 및 인증 UI |
| `useBoardImages` | 이미지 컬렉션과 업로드 | 이미지 input, CRUD, 편집 ID |
| `useBoardMemos` | 메모 컬렉션 | CRUD, 편집 ID |
| `useBoardMemoFocus` | 포커스 메모, 이전/다음 이동, 연번 이동 | MemoCard 포커스, `BoardNavigator`의 `focusedMemoOrder`·`memoCount`·`focusMemoByOrder` |
| `useBoardSearch` | 검색어·결과·인덱스 | 검색 패널과 메모 포커스 |
| `useBoardMermaids` | Mermaid 컬렉션 | CRUD, 편집 ID |
| `useBoardTables` | Table 컬렉션 | CRUD, 편집 ID |
| `useBoardDrawing` | 획·드로잉 모드·도구 | DrawingLayer와 DrawingToolBar |
| `useBoardScroll` | 보드 패닝과 입력 보호 | `.board-scroll-layer` pointer 이벤트 |
| `useCardLayer` | 네 카드 타입의 z 갱신 | 각 카드 전용 툴바의 front/back |
| `useAiAssistant` | AI 채팅, 사용 가능 여부, 미저장 생성·수정·삭제·이동 상태 | 네 카드 컬렉션과 메모·Mermaid·표의 insert/update/delete, 이미지 insert/delete 핸들러를 주입 |

## 파생 편집 상태

```ts
const isEditing =
    editingMemoId !== null ||
    editingImageId !== null ||
    editingMermaidId !== null ||
    editingTableId !== null;
```

- `useBoardScroll`은 이 값이 true면 일반 보드 패닝을 제한한다.
- `BoardToolBar`에는 `isEditing || drawingMode`를 전달해 일반 도구를 숨긴다.
- 각 카드의 편집 ID는 카드 컬렉션 훅이 독립적으로 소유한다. BoardClient는 이를 하나의 파생 플래그로만 결합한다.

## 미리보기 갱신 연결

`useBoardPreview`가 반환한 `schedulePreviewUpdate`를 `useBoardImages`, `useBoardMemos`, `useBoardMermaids`, `useBoardTables`, `useBoardDrawing`의 `onPreviewUpdate`로 동일하게 전달한다. 현재 각 컬렉션 훅은 INSERT/UPDATE 성공 후, 드로잉 훅은 획 저장 성공 후 이 콜백을 호출한다.

## 렌더 구조

```text
hidden image input
BoardMenu
BoardToolBar
DrawingToolBar (drawingMode)
BoardSearchPanel (searchBarOpen)
BoardNavigator (boardNavigatorOpen)
SignInModal / SignUpModal
BoardMarkdownView (markdownViewOpen)
AboutModal (aboutOpen)
AiAssistantButton
AiChatPanel (aiPanelOpen)
BoardMessage(permission / memo)
main
└ board-scroll-layer
   └ board-size-layer
      └ kyu-board
         ├ ImageCard[]
         ├ MemoCard[]
         ├ MermaidCard[]
         ├ TableCard[]
         └ DrawingLayer
```

### 보드 레이어

- `.board-scroll-layer`: 실제 스크롤 컨테이너이자 `cardLocationRef` 대상
- `.board-size-layer`: `boardWidth * zoom`, `boardHeight * zoom`으로 스크롤 가능한 전체 크기를 확보
- `.kyu-board`: 원본 보드 크기를 유지하고 `transform: scale(boardZoom)` 적용
- 배경은 24px 간격 점 패턴이며 패닝 상태에 따라 grab/grabbing 커서를 표시

### 카드 공통 배선

네 카드 타입은 다음 형태로 연결된다.

- `isEditing={editing{Type}Id === item.id}`
- `onEditing` / `onEditingClear`로 타입별 편집 ID 설정·해제
- `onPermissionDenied={showPermissionMessage}`
- 타입별 INSERT/UPDATE/DELETE 핸들러
- `handleCardLayer(type, id, "front" | "back")`

MemoCard만 별도로 `isFocused`, `onFocus`, `onFocusClear`를 받는다.

### DrawingLayer 재마운트

```tsx
key={drawingMode ? "drawing-active" : "drawing-inactive"}
```

드로잉 모드 전환 시 `DrawingLayer`를 재마운트해 `useDrawingPointer`가 보유한 포인터 소유권 Ref를 초기화한다.

## 이벤트 배선

| 이벤트 | 핸들러 |
| --- | --- |
| 숨김 이미지 input `onChange` | `handleUploadImage` |
| 보드 pointer down/move/up | `handleBoardPanStart` / `Move` / `End` |
| BoardMenu Compile | `setMarkdownViewOpen(true)` |
| BoardMenu About | `setAboutOpen(true)` |
| AI 어시스턴트 버튼 | `handleToggleAiPanel` — 권한과 서버 AI 설정 여부를 확인한 뒤 채팅 패널을 연다 |
| BoardToolBar 탐색/검색 토글 | `setBoardNavigatorOpen` / `setSearchBarOpen` — 한쪽을 열면 다른 쪽과 `menuOpen`을 닫는다 |
| main click | `setPermissionMessage("")`, `setMemoMessage("")` |

## 변경 시 확인 지점

- 새 카드 타입은 서버 초기 조회, BoardClient props/map, 전용 컬렉션 훅, 편집 상태 결합, 레이어 API, Markdown 컴파일과 미리보기 갱신을 함께 검토한다.
- `cardLocationRef`는 좌표 계산·패닝·캡처가 공유하므로 다른 DOM으로 옮길 때 세 기능의 기준이 동시에 바뀐다.
- 타입별 편집 ID는 상호 배타성을 강제하는 단일 상태가 아니므로 편집 전환 로직을 추가할 때 다른 타입의 ID 정리 여부를 확인한다.

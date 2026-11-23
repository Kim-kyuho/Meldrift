# BoardClient 상세설계

소스: `packages/ui/src/features/board/BoardClient.tsx`, `packages/ui/src/features/board/BoardWorkspace.tsx`

보드 화면 전체다. 카드 네 종류, 드로잉, 다중 선택, 검색, 탐색, 줌, 순서 패널, 단축키, Undo/Redo, Markdown 뷰, AI 어시스턴트를 여기서 조립한다. 두 Edition이 같은 파일을 쓴다.

Edition마다 다른 것은 **저장소, 메뉴 껍데기, 보드 위 오버레이**뿐이라 그것만 밖에서 받는다. 저장 예약과 반출입 흐름은 [BoardControls](./board-controls.md)가 안에서 처리한다.

## 두 겹

| 컴포넌트 | 역할 |
| --- | --- |
| `BoardClient` | 앱이 쓰는 입구. 일반 보드와 튜토리얼 샌드박스를 바꿔 끼우고, 새 보드 첫 진입이면 Help를 자동으로 연다 |
| `BoardWorkspace` | 보드 화면 본체. 카드·드로잉·선택·검색·줌·이력·협업과 `BoardControls`, Help·튜토리얼 화면을 조립한다 |

일반 보드와 튜토리얼 보드는 동시에 마운트하지 않는다. 자세한 전환 규칙은 [인터랙티브 튜토리얼](./interactive-tutorial.md), 첫 진입 규칙은 [Help](./help-modal.md)를 참조한다.

## 계약

```ts
type BoardClientProps = {
    initialSnapshot: BoardSnapshot;
    storage?: BoardStorage;
    guide?: BoardGuide;
    canEdit?: boolean;
    canExport?: boolean;
    permissionMessage?: string;
    viewportRef?: RefObject<HTMLDivElement | null>;
    menuTitle?: string;
    renderMenu: (menu: BoardMenuControls) => ReactNode;
    collaboration?: BoardCollaboration;
};
```

| Prop | 기본값 | 의미 |
| --- | --- | --- |
| `initialSnapshot` | 필수 | 화면을 채울 초기 보드. 이미 읽혀 있는 값이어야 한다 |
| `storage` | 없음 | 저장과 세이브 파일 구현. 없으면 저장하지 않고 파일 항목을 잠근다. [BoardControls](./board-controls.md) 참조 |
| `guide` | 없음 | Help 문서·마스코트 경로와 첫 진입 기록 범위. 없으면 Help와 튜토리얼이 꺼진다. [Help](./help-modal.md) 참조 |
| `canEdit` | `true` | 카드 편집 허용 여부. Free는 넘기지 않고, Plus는 계정 권한과 보드가 열린 상태인지를 곱해 넘긴다 |
| `canExport` | `true` | 세이브 파일 내보내기 허용 여부. Plus는 로그인 여부를 넘긴다 |
| `permissionMessage` | `Please sign in before editing cards.` | `canEdit`이 false일 때 띄울 문구 |
| `viewportRef` | 내부 ref | 보드 스크롤 레이어. Plus가 미리보기 캡처에 쓴다. 튜토리얼 보드에는 넘기지 않는다 |
| `menuTitle` | 보드 제목 | 메뉴 머리 제목. Free는 `Free Board`를 넘긴다. 튜토리얼에서는 샌드박스 보드 제목을 쓴다 |
| `renderMenu` | 필수 | 앱별 메뉴 래퍼를 그린다. 넘겨받은 `BoardMenuControls`를 공통 `BoardMenu`에 펼쳐 넣는다 |
| `collaboration` | 없음 | Plus Live 협업 상태와 동작. 튜토리얼 보드에는 넘기지 않는다 |

`initialSnapshot`을 Promise나 `null`로 받지 않는다. **불러오기는 껍데기의 일이고**, 이 컴포넌트는 값이 있는 상태로만 마운트된다.

앱이 그리는 것은 메뉴 래퍼(`renderMenu`) 하나뿐이다. 저장·반출입은 `BoardControls`, Help·튜토리얼은 `BoardWorkspace`가 내부 상태로 직접 그린다. 앱으로 보드 내부 상태를 내보내는 통로는 없다.

## 스냅샷

```ts
const snapshot = useMemo(() => ({ board, memos, images, mermaids, tables, strokes }), [...]);
```

카드 컬렉션 훅들이 소유한 상태가 여기 한 값으로 모인다. 저장·내보내기·Markdown 컴파일이 전부 이 값 하나를 본다.

## `savePaused`

```ts
const savePaused = isEditing || drawingMode || hasPendingAiCards;
```

| 조건 | 막는 이유 |
| --- | --- |
| 카드 편집 중 | 확정되지 않은 초안을 쓰지 않는다 |
| 드로잉 모드 | 획은 입력 종료 때 상태와 이력에 반영되지만 영속 저장은 모드를 끈 뒤에 실행한다 |
| AI 제안 대기 | 임시 카드가 음수 id라 `board-state` 검증에 걸린다 |

`isEditing`은 네 종류의 `editing{Type}Id` 중 하나라도 있으면 참이다. 카드별 편집 id는 각 컬렉션 훅이 따로 소유하고, 여기서는 하나의 파생 플래그로만 합친다.

## 권한

`canEdit`이 false일 때 막는 자리는 전부 이 컴포넌트 안에 있다. 훅들은 권한을 모른다.

```ts
const withPermission = (action) => () => {
    if (!canEditCard) { showPermissionMessage(); return; }
    action();
};
```

카드 생성 버튼, 이미지 업로드·드롭, 순서 패널의 끌기 시작, 카드 컴포넌트의 `onPermissionDenied`, `useAiAssistant`의 `canEdit`이 같은 판정을 공유한다.

Undo/Redo 실행과 `onGeometryChange`로 전달된 카드 좌표 반영도 같은 편집 권한을 검사한다.

## 조립하는 훅

| 출처 | 훅 |
| --- | --- |
| `@meldrift/ui` | `useBoardMemos`, `useBoardImages`, `useBoardMermaids`, `useBoardTables`, `useCardLayer`, `useMemoReorder`, `useAiAssistant` |
| `@meldrift/ui` | `useBoardZoom`, `useBoardPinchZoom`, `useBoardScroll`, `useBoardSearch`, `useBoardMemoFocus`, `useBoardDrawing`, `useBoardImageDrop` |
| 공통 보드 내부 | `useBoardHistory`, `useBoardPointerActive`, `useBoardShortcuts` |
| 선택 | `useBoardSelection`, `useSelectionPointer` |

보드 화면과 카드 상태를 다루는 React 훅은 `@meldrift/ui`에 둔다. 데이터 구조·저장·변환 코드는 `@meldrift/board-data`에서 가져온다.

## 렌더 구조

```text
hidden image input
BoardControls               ← 저장 예약, 반출입, renderMenu(...)
HelpOverlay (help)          ← Help 모달, Help 종료 후 런처, Help 단축키
TutorialGuide (tutorial)    ← 튜토리얼 단계 안내
BoardHistoryToolbar         ← 하단 중앙 Undo/Redo
BoardToolBar
SelectionToolBar (cardsSelected)
DrawingToolBar (drawingMode)
BoardSearchPanel / BoardNavigator / MemoReorderPanel
BoardMarkdownView (markdownViewOpen)
AboutModal (aboutOpen)
AiAssistantButton / AiChatPanel / AiUnlockPanel
BoardMessage
BoardImageDropOverlay
main
└ board-scroll-layer      ← viewportRef
   └ board-size-layer     ← boardWidth * zoom
      └ meldrift-board    ← transform: scale(zoom)
         ├ ImageCard[] / MemoCard[] / MermaidCard[] / TableCard[]
         ├ DrawingLayer
         └ SelectionLayer (selectionActive)
```

`DrawingLayer`는 드로잉 모드가 바뀔 때 `key`로 재마운트한다. `useDrawingPointer`가 들고 있는 포인터 소유권 Ref를 비우기 위해서다.

## 작업 완료와 이력

네 카드의 `onGeometryChange`는 이동·리사이즈 종료마다 위치·크기만 컬렉션에 반영한다. 내용은 카드의 편집 완료 콜백에서 반영한다. 음수 ID 임시 카드와 AI 제안은 확정 전 기록을 보류한다.

지우개의 이동 프레임은 `onInteractionChange`로 한 입력으로 묶는다. 물리 포인터의 활성 여부는 버튼 실행 차단에 별도로 사용한다. 기록과 영속 저장의 보류 조건은 같지 않다.

`applyContent`는 공통 복원 경로다. 컬렉션과 획을 교체하고 `contentVersion`을 올리며 편집 ID·포커스·선택을 비운다. `initialSnapshot`이 새 서버 상태로 교체되면 화면과 이력도 초기화한다. 복원한 상태는 `snapshot`으로 다시 저장 계층에 전달된다.

세부 규칙은 [보드 이력](./board-history.md), 키 입력 보호는 [보드 단축키](./board-shortcuts.md)를 참조한다.

## 변경 시 확인 지점

- 새 카드 종류는 컬렉션 훅, 스냅샷 조립, 레이어 계산, Markdown 컴파일, `board-state` 스키마, SQLite 스키마를 함께 본다.
- `viewportRef`는 좌표 계산·패닝·Plus 미리보기 캡처가 공유한다. 다른 DOM으로 옮기면 셋의 기준이 동시에 바뀐다.
- `savePaused`에 조건을 더하면 Free의 자동 저장과 Plus의 서버 업로드가 같이 멈춘다.
- 메뉴 항목의 잠금 조건은 `BoardControls`가 계산한다. 앱 메뉴 래퍼에 권한 판단을 다시 넣지 않는다.

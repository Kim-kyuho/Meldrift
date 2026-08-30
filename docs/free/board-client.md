# BoardClient 상세설계 (Free)

소스: `app/page.tsx`, `components/BoardClient.tsx`

## Plus와 갈리는 지점

| | Plus | Free |
| --- | --- | --- |
| 초기 데이터 | 서버 컴포넌트가 DB를 조회해 props로 내려준다 | props가 없다. 마운트 후 워커에서 읽는다 |
| Props | `currentBoard`, `mappedImages` 등 | 없음 |
| 저장 | 카드마다 Route Handler 호출 | 스냅샷 하나를 통째로 워커에 넘긴다 |
| 보드 | 여러 개, 목록 화면 있음 | `defaultBoard` 하나 |
| 인증 | 로그인·권한 | 없음 |
| 미리보기 | 있음 | 없음 |

`app/page.tsx`는 `BoardClient`를 그리는 것 외에 하는 일이 없다.

## 부품 출처

`@meldrift/ui`에서 가져오는 것과 Free가 직접 가진 것이 섞여 있다.

| 출처 | 컴포넌트 |
| --- | --- |
| `@meldrift/ui` | `MemoCard`, `MermaidCard`, `TableCard`, `BoardSearchPanel`, `BoardNavigator`, `MemoReorderPanel`, `DrawingToolBar`, `ConfirmDialog`, `AiAssistantButton` |
| Free 로컬 | `ImageCard`, `BoardMenu`, `BoardToolBar`, `BoardMessage`, `BoardMarkdownView`, `DrawingLayer`, `AboutModal`, `HelpModal`, `AiChatPanel`, `AiUnlockPanel` |
| `@meldrift/ui` 훅 | `useBoardMemoFocus`, `useBoardScroll`, `useBoardSearch`, `useBoardZoom` |
| Free 로컬 훅 | `useBoardMemos`, `useBoardImages`, `useBoardMermaids`, `useBoardTables`, `useBoardDrawing`, `useCardLayer`, `useMemoReorder`, `useBoardTransfer`, `useAiAssistant` |

카드 컬렉션 훅이 로컬인 이유는 저장 방식이 다르기 때문이다. 화면 조작 훅(줌·스크롤·검색·포커스)은 저장과 무관해서 그대로 공유한다.

## 초기화

| 상태 | 의미 |
| --- | --- |
| `databaseReady` | 워커에서 스냅샷을 한 번 읽어 화면에 반영했다 |
| `databaseError` | 워커 초기화 실패 문구 |

마운트 시 `loadBoardState()`를 호출하고, 성공하면 `applySnapshot`으로 다섯 컬렉션과 보드 정보를 채운 뒤 `databaseReady`를 세운다. 이어서 `isBoardContentEmpty(stored)`이면 Help를 연다.

effect는 `active` 플래그로 언마운트 후 setState를 막는다. 실패하면 문구만 남기고 `databaseReady`는 서지 않는다.

## 스냅샷

```text
snapshot = useMemo({ board: currentBoard, memos, images, mermaids, tables, strokes })
```

화면의 모든 상태가 모이는 단일 값이다. 저장과 내보내기 둘 다 이 값 하나를 쓴다.

## 자동 저장

```text
조건: databaseReady && !isEditing && !drawingMode && !hasPendingAiCards && !resetting
지연: 150ms
동작: replaceBoardState(snapshot)
```

`snapshot`이 바뀔 때마다 타이머를 다시 건다. 실패하면 보드 메시지로 문구를 띄운다.

저장을 막는 조건에는 이유가 있다.

- **편집 중·드로잉 중**: 초안이 확정되기 전 상태를 쓰지 않는다.
- **AI 제안이 남아 있을 때**: 임시 카드는 음수 id라서 `board-state`의 양의 정수 검증에 걸린다.
- **리셋 중**: 방금 지운 브라우저 DB가 저장으로 되살아나는 것을 막는다.

부분 갱신이 없다. 워커가 `DELETE` 후 전부 다시 INSERT하므로 한 번의 저장이 보드 전체를 다시 쓴다.

## 편집 상태와 잠금

`editingMemoId`·`editingImageId`·`editingMermaidId`·`editingTableId` 중 하나라도 있으면 `isEditing`이다.

```text
exportDisabled = isEditing || drawingMode || hasPendingAiCards
```

내보내기는 저장과 같은 이유로 잠근다. 내보내기 직전에 `replaceBoardState`를 한 번 더 부르므로, 잠그지 않으면 확정되지 않은 초안이 파일에 들어간다.

## 화면 열림 상태

`menuOpen`, `aboutOpen`, `helpOpen`, `markdownViewOpen`, `boardNavigatorOpen`, `boardMessage`를 직접 들고 있다.

`openHelp()`는 메뉴·About·Markdown 뷰를 먼저 닫고 Help를 연다. 겹쳐 뜨는 것을 막는다.

## Help 단축키

`window`에 캡처 단계로 `keydown` 리스너를 붙인다. `Ctrl` 또는 `⌘` + `Shift` + `H`에서 `preventDefault` 후 `openHelp()`를 부른다. 캡처 단계라 메모 편집기가 키를 삼켜도 동작한다.

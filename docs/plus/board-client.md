# BoardClient 상세설계

소스: `app/layout.tsx`, `app/boards/[boardId]/page.tsx`, `components/BoardSync.tsx`, `components/BoardClient.tsx`

보드 화면 자체는 [공유 BoardClient](../shared/board-client.md)다. Plus가 가진 것은 **인증과 동기화**를 그 위에 얹는 두 겹의 껍데기다.

```text
app/boards/[boardId]/page.tsx   서버 컴포넌트. 보드 메타데이터만 조회
└ BoardSync                     보드 동기화, 상태 표시, 복구 덮개
   └ BoardClient                인증 모달, 미리보기, 저장 전달
      └ SharedBoardClient       보드 화면 전체
```

## `app/layout.tsx`

루트 레이아웃이다. 전역 CSS를 불러오고 `<html lang="en">`과 세로 flex `<body>`를 세운 뒤 Vercel Analytics를 붙인다. 메타데이터는 제목 `Meldrift+`와 파비콘·애플 터치 아이콘이다.

`next.config.ts`의 `basePath`가 `/plus`이므로(`PLUS_STANDALONE=true`일 때는 없음) 이 레이아웃 아래의 모든 경로가 `/plus` 밑으로 들어간다.

## `app/boards/[boardId]/page.tsx`

서버 컴포넌트가 하는 일이 하나로 줄었다.

```ts
const [board] = await db.select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);
if (!board) notFound();
return <BoardSync key={boardId} board={{ boardId, title, width, height }} />;
```

**카드를 조회하지 않는다.** 보드 내용은 클라이언트가 스냅샷으로 받는다. 서버가 내려주는 것은 보드 메타데이터 넷뿐이다.

`boardId`가 양의 정수가 아니거나 보드가 없으면 `notFound()`다. `key={boardId}`는 보드를 옮겨 다닐 때 아래 트리를 통째로 다시 마운트해, 이전 보드의 동기화 상태가 새 보드로 새는 것을 막는다.

## `BoardSync`

[변경분 동기화](./change-sync.md)와 [호환 스냅샷](./board-snapshot.md)을 다루는 `useBoardSync`을 부르고 그 결과로 세 가지를 그린다.

| 상태 | 화면 |
| --- | --- |
| 스냅샷 없음 | 덮개 + `Loading...` |
| `blocked` | 보드를 `inert`로 덮고 사유 문구 + 복구 버튼 셋 |
| 그 외 | 보드 + 왼쪽 아래 저장 상태 문구 |

저장 상태 문구는 편집 권한이 있을 때만 보인다. 읽기만 하는 사람에게 `Saved`는 의미가 없다.

## `BoardClient`

공유 BoardClient에 Plus의 사정을 주입하는 얇은 래퍼다.

| Prop | 의미 |
| --- | --- |
| `initialSnapshot` | 동기화 계층이 확정한 초기 보드 |
| `editingAllowed` | 보드가 편집 가능한 상태인가 |
| `storage` | `useBoardSync`이 만든 저장소. 공유 BoardClient에 그대로 넘긴다 |
| `serverSaveVersion` | 서버 저장이 성공한 횟수. 미리보기 갱신 트리거 |

### 편집 권한

```ts
const canEdit = canCreateBoard(currentUser) && editingAllowed;
```

두 가지를 곱한다. `canCreateBoard`는 계정이 승인됐는가(`useBoardAuth`의 `currentUser`), `editingAllowed`는 보드 권한과 동기화 상태로 편집 가능한가다(`blocked`이면 false). 둘 중 하나라도 없으면 공유 BoardClient가 카드 조작을 막고 권한 문구를 띄운다.

문구도 상황에 따라 갈린다.

| 상황 | 문구 |
| --- | --- |
| 로그인함, 편집 불가 | `You can view this board, but you cannot edit it.` |
| 로그인 안 함 | `Please sign in before editing cards.` |

### 저장소와 반출입

`useBoardSync`이 `createPlusBoardStorage`(`lib/board-storage.ts`)로 저장소를 만들어 돌려준다. 저장 예약과 반출입 흐름은 공유 BoardClient 안의 [BoardControls](../shared/board-controls.md)가 처리한다.

| 저장소 | 값 |
| --- | --- |
| `save` | 동기화 계층(`ChangeSync`·`SnapshotSync`)의 `save` |
| `file.exportFile` | 워커 `encode` |
| `file.readFile` | 워커 `decode` 후 이미지 바이트가 없으면 거부, `reissueSyncIds`로 새 동기화 ID 부여 |
| `file.maxImportBytes` | `maxSnapshotBytes`(4 MiB) |
| `file.fileName` | `meldrift-board-{boardId}.sqlite` |
| `skipInitialSave` | `true` — 서버에서 받은 초기 값을 다시 저장하지 않는다 |

`canExport`는 로그인 여부다. Import·Reset은 공유 BoardClient의 편집 가능 상태(`canEditCard`)를 따른다. 저장 보류는 `!canEdit || savePaused`다.

로컬 저장 성공 후 원격 전송은 저장 모드에 따라 `ChangeSync` 또는 `SnapshotSync`가 3초로 묶는다. 150ms 로컬 저장과 3초 서버 전송은 서로 다른 예약이다.

Import·Reset은 공유 `replaceSnapshot`을 거쳐 하나의 Undo 작업이 된다. Undo/Redo는 현재 객체를 복원할 뿐 서버 revision·전송 큐를 되감지 않는다. 계정 전환은 재로그인 후 페이지를 다시 열며, 서버 상태 복원도 편집기 트리를 다시 마운트해 이전 이력을 버린다.

### 메뉴와 인증 모달

`renderMenu`로 `components/BoardMenu.tsx`를 그린다. 공통 메뉴 상태(`BoardMenuControls`, 제목 포함)를 그대로 펼쳐 넣고 계정 정보를 더한다. 로그인·가입 모달은 공유 BoardClient 바깥에 형제로 그린다.

### Help와 튜토리얼

`guide={plusBoardGuide}`(`lib/board-guide.ts`)를 넘긴다. Help 문서는 `public/help/`의 Plus 판이고(`Meldrift+ Storage` 절), 마스코트는 `/plus/meldrift-mascot.png`다. 새 보드에 처음 들어오면 Help가 자동으로 열린다. 튜토리얼 보드에는 저장소·Live·미리보기 캡처 대상을 넘기지 않는다. [Help](../shared/help-modal.md), [인터랙티브 튜토리얼](../shared/interactive-tutorial.md)을 참조한다.

### 미리보기

```ts
useEffect(() => {
    if (serverSaveVersion > 0 && canEdit) schedulePreviewUpdate();
}, [serverSaveVersion, canEdit, schedulePreviewUpdate]);
```

미리보기는 **서버 저장이 끝난 뒤에만** 갱신한다. 로컬에만 있는 변경으로 목록 썸네일을 바꾸면 다른 사람이 보는 목록과 어긋난다. 캡처 대상은 `viewportRef`로 공유 BoardClient에서 받아 온다.

## 변경 시 확인 지점

- 저장소 계약(`BoardStorage`)이 바뀌면 `lib/board-storage.ts`와 Free의 `freeBoardStorage`를 함께 고친다.
- `canEdit`은 계정 권한과 보드 상태의 곱이다. 한쪽만 보고 판단하는 코드를 새로 넣지 않는다.

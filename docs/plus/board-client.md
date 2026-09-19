# BoardClient 상세설계

소스: `app/layout.tsx`, `app/boards/[boardId]/page.tsx`, `components/BoardSnapshotClient.tsx`, `components/BoardClient.tsx`

보드 화면 자체는 [공유 BoardClient](../shared/board-client.md)다. Plus가 가진 것은 **인증과 동기화**를 그 위에 얹는 두 겹의 껍데기다.

```text
app/boards/[boardId]/page.tsx   서버 컴포넌트. 보드 메타데이터만 조회
└ BoardSnapshotClient           스냅샷 동기화, 상태 표시, 복구 덮개
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
return <BoardSnapshotClient key={boardId} board={{ boardId, title, width, height }} />;
```

**카드를 조회하지 않는다.** 보드 내용은 클라이언트가 스냅샷으로 받는다. 서버가 내려주는 것은 보드 메타데이터 넷뿐이다.

`boardId`가 양의 정수가 아니거나 보드가 없으면 `notFound()`다. `key={boardId}`는 보드를 옮겨 다닐 때 아래 트리를 통째로 다시 마운트해, 이전 보드의 동기화 상태가 새 보드로 새는 것을 막는다.

## `BoardSnapshotClient`

[보드 스냅샷](./board-snapshot.md)의 `useBoardSnapshot`을 부르고 그 결과로 세 가지를 그린다.

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
| `onSnapshotChange` | 스냅샷이 바뀌었을 때 부를 저장 함수 |
| `serverSaveVersion` | 서버 저장이 성공한 횟수. 미리보기 갱신 트리거 |

### 편집 권한

```ts
const canEdit = canEditCard && editingAllowed;
```

두 가지를 곱한다. `canEditCard`는 계정이 승인됐는가(`useBoardAuth`), `editingAllowed`는 보드가 편집 가능한 상태인가다(`blocked`이면 false). 둘 중 하나라도 없으면 공유 BoardClient가 카드 조작을 막고 권한 문구를 띄운다.

문구도 상황에 따라 갈린다.

| 상황 | 문구 |
| --- | --- |
| 로그인함, 승인 대기 | `Your account is waiting for administrator approval.` |
| 로그인 안 함 | `Please sign in before editing cards.` |

### `SnapshotPersistence`

`renderControls` 안에 그려지는, 아무것도 렌더하지 않는 컴포넌트다.

```ts
useEffect(() => {
    if (!canEdit || savePaused || snapshot === lastSavedRef.current) return;
    lastSavedRef.current = snapshot;
    onSnapshotChange(snapshot);
}, [snapshot, canEdit, savePaused, onSnapshotChange]);
```

`lastSavedRef`가 참조 동일성을 기억하므로 **마운트 직후의 초기 스냅샷은 저장되지 않는다.** 방금 서버에서 받은 것을 그대로 되올리는 낭비를 막는다.

Free의 `useBoardPersistance`와 달리 디바운스가 없다. 카드 조작은 `onDragStop`·`onResizeStop`처럼 확정 시점에만 상태를 바꾸므로 한 동작에 한 번 불린다. 서버로 나가는 요청은 `SnapshotSync`가 3초로 묶는다.

### 미리보기

```ts
useEffect(() => {
    if (serverSaveVersion > 0 && canEdit) schedulePreviewUpdate();
}, [serverSaveVersion, canEdit, schedulePreviewUpdate]);
```

미리보기는 **서버 저장이 끝난 뒤에만** 갱신한다. 로컬에만 있는 변경으로 목록 썸네일을 바꾸면 다른 사람이 보는 목록과 어긋난다. 캡처 대상은 `viewportRef`로 공유 BoardClient에서 받아 온다.

## 변경 시 확인 지점

- 공유 BoardClient의 `BoardControls` 계약이 바뀌면 Free의 `BoardControls`와 여기의 `renderControls`를 함께 고쳐야 한다.
- `canEdit`은 계정 권한과 보드 상태의 곱이다. 한쪽만 보고 판단하는 코드를 새로 넣지 않는다.

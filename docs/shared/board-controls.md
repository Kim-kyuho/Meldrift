# BoardControls 상세설계

소스: `packages/ui/src/features/board/BoardControls.tsx`, `packages/ui/src/features/board/board-storage.ts`, `packages/ui/src/features/board/useBoardFileTransfer.ts`, `packages/ui/src/features/board/useBoardPersistence.ts`, `packages/ui/src/features/board/BoardMenu.tsx`

공유 BoardClient 안에서 저장 예약, 파일 반출입(Export·Import·Reset), 보드 메뉴를 맡는다. 두 Edition이 같은 흐름을 쓰고, Edition은 **어디에 저장하고 파일을 어떻게 만들고 읽는지**만 `BoardStorage`로 넘긴다.

## 저장소 계약

```ts
type BoardFileAdapter = {
    fileName: (board: BoardInfo) => string;
    maxImportBytes: number;
    exportFile: (snapshot: BoardSnapshot) => Promise<ArrayBuffer>;
    readFile: (bytes: ArrayBuffer) => Promise<BoardSnapshot>;
};

type BoardStorage = {
    save: (snapshot: BoardSnapshot) => void | Promise<void>;
    file?: BoardFileAdapter;
    skipInitialSave?: boolean;
};
```

| 필드 | 의미 |
| --- | --- |
| `save` | 확정된 화면 상태를 저장한다 |
| `file` | 세이브 파일 기능. 없으면 Export·Import를 잠근다 |
| `skipInitialSave` | 마운트 직후 받은 스냅샷을 다시 저장하지 않는다. 튜토리얼에서 돌아올 때는 공유 BoardClient가 이 값을 끄고 다시 마운트해, 튜토리얼 직전까지 저장되지 않았던 변경을 남긴다 |
| `fileName` | Export 파일 이름 |
| `maxImportBytes` | Import 파일 크기 상한. 넘으면 읽지 않는다 |
| `exportFile` | 현재 화면으로 세이브 파일 바이트를 만든다. DB를 건드리지 않는다 |
| `readFile` | 세이브 파일을 검증·해석한다. Edition별 검증과 식별자 재발급은 여기서 끝낸다 |

| Edition | 구현 | 차이 |
| --- | --- | --- |
| Free | `apps/free/lib/board-storage.ts`의 `freeBoardStorage` | `replaceBoardState`, `encodeBoardDatabase`, `decodeBoardDatabase`(board_id 1만 허용), 50 MiB, `meldrift-free.sqlite`. 불러온 초기 값은 다시 저장하지 않는다 |
| Plus | `apps/plus/lib/board-storage.ts`의 `createPlusBoardStorage` | 동기화 계층의 `save`, 워커 `encode`·`decode`, `maxSnapshotBytes`(4 MiB), `meldrift-board-{boardId}.sqlite`. 이미지 바이트가 없으면 거부하고 `reissueSyncIds`로 새 동기화 ID를 준다. 서버에서 받은 초기 값은 다시 저장하지 않는다 |
| 튜토리얼 | 넘기지 않음 | 저장하지 않고 파일 항목을 모두 잠근다 |

## 공유 BoardClient가 넘기는 값

| Prop | 출처 | 의미 |
| --- | --- | --- |
| `storage` | 앱 | 위 계약 |
| `renderMenu` | 앱 | 앱별 메뉴 래퍼(브랜드·계정 영역)를 그린다 |
| `snapshot`, `savePaused` | BoardClient | 현재 화면과 저장 보류 여부 |
| `canSave` | BoardClient의 `canEdit` prop | 저장 권한. Live 상태와 무관하다 |
| `canEdit` | BoardClient의 `canEditCard` | 지금 편집 가능한가. Live 연결 대기·보드 잠금이면 false |
| `canExport` | 앱 | 내보내기 권한. Plus는 로그인 여부 |
| `menuOpen`, `setMenuOpen`, `reorderOpen`, `onReorder`, `onCompileMarkdown`, `onAbout` | BoardClient | 메뉴 상태와 항목 동작 |
| `replaceSnapshot` | BoardClient | 보드 내용 교체. 권한·boardId 확인, Live 보드 잠금(`boardLockKey`), `applyContent`를 거친다 |
| `setMessage` | BoardClient | 보드 메시지 |

## 저장 예약

`useBoardPersistence`를 부른다.

```text
보류: !storage || !canSave || savePaused
지연: 150ms, 연속 변경은 마지막 값 하나로 합친다
동작: storage.save(snapshot)
실패: "The board could not be saved." 또는 오류 문구를 setMessage로
```

`useBoardPersistence`는 `flush()`를 돌려준다. 예약을 기다리지 않고 지금 화면을 저장하며, 이미 같은 값을 저장했거나 보류 중이면 아무것도 하지 않는다. 다음 두 곳에서 쓴다.

| 시점 | 이유 |
| --- | --- |
| Export 직전 | 내려받은 파일과 저장된 상태가 같아야 한다. 내보낸 직후 새로고침해도 화면 그대로 남는다 |
| Import·Reset으로 화면이 바뀐 직후 | 보드 전체 교체는 150ms를 기다리지 않고 바로 저장한다. 교체 직후 새로고침해도 결과가 남는다 |

반출입이 진행 중이어도 저장을 멈추지 않는다. Import는 파일을 해석만 하고 DB에 직접 쓰지 않으므로, 화면 상태를 저장하는 경로가 하나뿐이다.

## 파일 반출입

`useBoardFileTransfer`가 맡는다. 최신 옵션은 ref로 읽고, 중복 실행(`busy`)과 언마운트 후 상태 변경(`active`)을 막는다.

### Export

1. `file`, `canExport`, `!savePaused`, 진행 중 아님을 확인한다.
2. `exportFile(snapshot)`으로 바이트를 만든다.
3. 그 사이 권한을 잃었거나 언마운트됐으면 내려받지 않는다.
4. `application/vnd.sqlite3` Blob을 `fileName(board)`로 내려받고 object URL을 해제한다.

### Import

1. input 값을 비워 같은 파일을 다시 고를 수 있게 한다.
2. `file`, `canEdit`, `!savePaused`, 진행 중 아님을 확인한다.
3. `maxImportBytes`를 넘으면 `The SQLite save file must be N MiB or smaller.`를 띄우고 읽지 않는다.
4. `readFile`로 해석한다. 실패하면 확인창 없이 오류 문구를 띄운다.
5. 읽는 사이 권한을 잃었으면 적용하지 않는다.
6. `window.confirm`으로 교체를 확인받는다.
7. `assignSnapshotToBoard`로 보드 정보와 카드별 `boardId`를 현재 보드로 맞춰 `replaceSnapshot`한다.

페이지를 새로고침하지 않는다. 교체 전 상태는 하나의 Undo 작업으로 남는다.

### Reset

`canEdit`과 `!savePaused`일 때 확인창(`Reset this board?`)을 연다. 확인하면 빈 스냅샷에 현재 보드 정보를 넣어 `replaceSnapshot`한다. DB·IndexedDB를 지우지 않으므로 새로고침 전까지 Undo로 되돌릴 수 있다.

## 메뉴 항목 상태

`renderMenu`에 `BoardMenuControls`를 넘긴다. 앱 래퍼는 이 값을 그대로 공통 `BoardMenu`에 펼쳐 넣는다.

```ts
type BoardMenuControls = {
    menuOpen: boolean;
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    boardActions?: BoardMenuActions;
    onAbout: () => void;
};
```

`boardActions`가 없으면 보드 전용 항목을 숨긴다(Plus 보드 목록 화면). 보드 화면에서는 아래처럼 계산해 넘긴다.

| 항목 | 잠기는 조건 |
| --- | --- |
| Export | `!file \|\| !canExport \|\| savePaused \|\| transferring` |
| Import | `!file \|\| !canEdit \|\| savePaused \|\| transferring` |
| Reset | `!storage \|\| !canEdit \|\| savePaused \|\| transferring` |

`exportPaused`(`file`이 있고 `savePaused`)일 때만 Export 툴팁을 바꾸고 `Finish editing before exporting.`를 덧붙인다. 저장소가 없는 튜토리얼에서는 띄우지 않는다.

UI 잠금만으로 권한을 보장하지 않는다. `useBoardFileTransfer`도 같은 조건을 다시 확인하고, Plus 서버 API도 권한을 검증한다.

검증: `packages/ui/tests/BoardControls.test.tsx`, `packages/ui/tests/useBoardFileTransfer.test.ts`, `apps/plus/tests/unit/board-storage.test.ts`, `apps/free/tests/e2e/lite-home.spec.ts`, `apps/free/tests/e2e/board-history.spec.ts`.

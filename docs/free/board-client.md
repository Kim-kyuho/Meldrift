# BoardClient 상세설계 (Free)

소스: `app/page.tsx`, `components/BoardClient.tsx`, `hooks/useBoardLoad.ts`, `lib/board-storage.ts`, `lib/board-guide.ts`, `public/help/`

보드 화면 자체는 [공유 BoardClient](../shared/board-client.md)다. Free가 가진 것은 **불러오기와 저장, 그리고 껍데기**뿐이다.

## 파일이 하는 일

| 파일 | 역할 |
| --- | --- |
| `hooks/useBoardLoad.ts` | 마운트 후 워커에서 스냅샷을 한 번 읽는다 |
| `components/BoardClient.tsx` | 읽기 전/실패 화면을 그리고, 읽히면 공유 BoardClient에 넘긴다 |
| `lib/board-storage.ts` | `freeBoardStorage` — 브라우저 DB 저장과 세이브 파일 구현 |
| `lib/board-guide.ts` | `freeBoardGuide` — Free Help 문서(`public/help/`)와 마스코트 경로 |

`app/page.tsx`는 `BoardClient`를 그리는 것 외에 하는 일이 없다.

## 불러오기

`useBoardLoad`는 `loadBoardState()` 하나를 부르고 결과를 상태로 돌려준다.

| 반환값 | 의미 |
| --- | --- |
| `initialSnapshot` | 읽힌 스냅샷. 읽기 전에는 `null` |
| `databaseError` | 워커 초기화 실패 문구 |

`active` 플래그로 언마운트 후 setState를 막는다.

`BoardClient`는 이 값으로 세 갈래를 그린다.

```text
databaseError    → 브라우저 SQLite 안내 화면
initialSnapshot 없음 → 제품 소개 + Loading...
그 외            → <SharedBoardClient initialSnapshot={...} storage={freeBoardStorage} guide={freeBoardGuide} menuTitle="Free Board" renderMenu={...} />
```

**빈 보드를 먼저 띄우고 나중에 채우지 않는다.** 그렇게 하면 읽기 전의 빈 스냅샷이 자동 저장에 실려 실제 데이터를 덮을 수 있다. 값이 있을 때만 편집기를 마운트하는 것이 그 방지책이다.

Help와 튜토리얼은 공유 BoardClient가 `freeBoardGuide`로 처리한다. Help는 새 보드 첫 진입에만 자동으로 열린다. [Help](../shared/help-modal.md), [인터랙티브 튜토리얼](../shared/interactive-tutorial.md)을 참조한다.

## 자동 저장과 반출입

공유 BoardClient 안의 `BoardControls`가 `freeBoardStorage`로 처리한다. 흐름은 [BoardControls](../shared/board-controls.md)를 참조한다.

| `freeBoardStorage` | 값 |
| --- | --- |
| `save` | `replaceBoardState(snapshot)` |
| `file.exportFile` | `encodeBoardDatabase` — 현재 화면으로 세이브 파일을 새로 만든다 |
| `file.readFile` | `decodeBoardDatabase` — board_id가 1인 파일만 해석한다. DB에는 쓰지 않는다 |
| `file.maxImportBytes` | 50 MiB |
| `file.fileName` | `meldrift-free.sqlite` |
| `skipInitialSave` | `true` — 불러온 초기 값을 다시 저장하지 않는다 |

부분 갱신이 없다. 워커가 `DELETE` 후 전부 다시 INSERT하므로 한 번의 저장이 보드 전체를 다시 쓴다.

공통 이력의 Undo/Redo도 같은 자동 저장 경로를 따른다. Import·Reset은 보드 전체를 바꾸므로 예약을 기다리지 않고 바로 저장한다. [보드 이력](../shared/board-history.md)을 참조한다.

## Plus와 갈리는 지점

| | Free | Plus |
| --- | --- | --- |
| 초기 데이터 | 마운트 후 워커에서 읽는다 | 서버가 보드 메타데이터만 내려주고, 스냅샷은 클라이언트가 받는다 |
| 저장 | `replaceBoardState` 한 번 | 브라우저 DB에 쓴 뒤 서버로 올린다 |
| 보드 | `defaultBoard` 하나 | 여러 개, 목록 화면 있음 |
| 인증 | 없음 | 로그인·승인 |
| 반출입 | `.sqlite` 세이브 파일·내용 Reset | 같은 파일 기능, 인증·편집 권한 검사 |

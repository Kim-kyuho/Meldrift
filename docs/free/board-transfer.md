# 보드 반출입 상세설계 (Free)

소스: `hooks/useBoardTransfer.ts`, `components/BoardControls.tsx`, `packages/board-data/src/browser-db/client.ts`

## 계약

| 입력 | 역할 |
| --- | --- |
| `exportDisabled` | 편집·드로잉·AI 제안이 끝나지 않았으면 파일 조작·Reset을 막는다 |
| `setMessage` | 변환·반출입 실패 메시지 |
| `getSnapshot` | 현재 보드 상태 |
| `replaceSnapshot` | 공통 BoardClient의 내용 교체, 내부 초안 초기화와 이력 연결 |

`transferring`은 Export·Import의 비동기 진행 상태다. `resetDialogOpen`은 확인 대화상자, `importInputRef`는 파일 선택창을 참조한다. Reset은 동기식 상태 교체라 `resetting` 반환값은 호환용 `false`다.

편집 중이거나 파일 전송 중이면 다른 파일 조작을 시작하지 않는다. `BoardControls`는 전송 중 자동 로컬 저장도 보류해 Import 도중 옛 화면 값이 DB를 덮지 않게 한다.

## Export

1. 현재 화면을 `replaceBoardState`로 먼저 저장한다.
2. `exportBoardDatabase`로 SQLite 바이트를 받는다.
3. `application/vnd.sqlite3` Blob을 `meldrift-free.sqlite`로 내려받는다.
4. 다운로드용 object URL을 해제한다.

이미지 바이너리와 모든 카드·획을 포함한다. 파일 백업은 메모리 이력과 별개다.

## Import

1. 선택 후 input 값을 비워 같은 파일의 재선택을 허용한다.
2. 현재 50 MiB 입력 한도를 검사한다.
3. `window.confirm`으로 보드 내용 교체를 확인받는다.
4. 워커의 `importBoardDatabase`가 파일을 검증하고 반환한 스냅샷을 읽는다.
5. 현재 보드 메타데이터를 유지한 채 `replaceSnapshot`으로 내용만 교체한다.

페이지를 새로고침하지 않는다. 교체 전 상태는 하나의 이력으로 남아 Undo로 복원할 수 있다. 실패 시 UI 내용을 교체하지 않고 워커 메시지를 표시한다.

## Reset

확인 후 빈 스냅샷에 현재 보드 정보를 넣어 `replaceSnapshot`을 호출한다. 카드·획만 비우고 SQLite 클라이언트와 IndexedDB를 파괴하지 않는다. 빈 상태의 영속 저장은 기존 자동 저장 경로가 처리한다.

Reset 자체는 한 번의 Undo 작업이다. 새로고침하거나 해당 작업이 최근 50개 범위에서 밀려나면 메모리 이력으로 복원할 수 없으므로 `.sqlite` 백업과 구분한다.

`resetBoardDatabase`는 여전히 저수준 DB 초기화 API로 남아 있지만 Free 메뉴 Reset에서 호출하지 않는다. Plus의 서버 상태 복원과도 다른 기능이다.

검증: `tests/unit/useBoardTransfer.test.ts`, `tests/e2e/board-history.spec.ts`, `tests/e2e/lite-home.spec.ts`.

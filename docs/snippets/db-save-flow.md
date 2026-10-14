# 저장 흐름

## 화면 상태와 작업 이력

공통 `BoardClient`가 보드 메타데이터와 메모·이미지·Mermaid·표·획을 `BoardSnapshot`으로 모은다. 카드 훅은 공통 상태를 수정하고 서버 API를 직접 호출하지 않는다.

`useBoardHistory`는 객체 배열만 사용하여 작업 완료 시점을 기록한다. 복원도 동일한 상태 변경 경로를 지나며 DB 파일 복제나 저장 응답 대기로 이력을 만들지 않는다.

메모·Mermaid·표의 신규 초안은 음수 ID이며 확정 시 `nextPositiveId`로 양수 ID를 받는다. 이미지는 변환 완료 후 양수 ID로 추가된다. 서버에서는 별도 불변 `syncId`로 객체를 식별한다.

## 저장 예약

| 단계 | Free | Plus |
| --- | --- | --- |
| 로컬 예약 | 공통 `useBoardPersistence`, 추가 변경 없는 150ms 후 저장 | 동일 |
| 로컬 반영 | SQLite worker → 전체 파일 직렬화 → IndexedDB | 동일 + 변경분 큐·동기화 상태 보존 |
| 서버 예약 | 없음 | 마지막 로컬 저장 성공 후 3초 |
| 서버 전송 | 없음 | delta 보드: 변경 필드·획과 신규 바이너리. snapshot 보드: 전체 SQLite |

편집·그리기 모드·AI 제안 미확정 중에는 `savePaused`로 영속 저장을 보류한다. 파일 반출입 중에도 자동 저장이 새 내용과 경쟁하지 않도록 예약을 제한한다. 작업 이력 기록과 저장 pause는 별도 조건이다.

## 전체 로컬 저장과 변경분 전송의 구분

현재 로컬 구현은 SQLite의 보드 내용을 트랜잭션으로 교체하고 직렬화된 파일을 IndexedDB에 저장한다. 이는 현재 구현 선택이며 IndexedDB가 부분 갱신을 할 수 없다는 의미는 아니다.

Plus delta 경로는 worker에서 직전 상태와 비교해 outbox를 생성한다. 전송 중인 묶음은 유지하고 추가 편집은 다음 묶음으로 남긴다. 좌표·크기만 바뀌면 이미지 바이너리는 다시 전송하지 않는다.

Undo/Redo도 새 로컬 변경으로 저장·동기화한다. 서버 revision이나 전송 중 mutation을 과거 값으로 돌려놓지 않는다.

구현: `packages/ui/src/features/board/useBoardPersistence.ts`, `packages/ui/src/features/board/useBoardHistory.ts`, `packages/board-data/src/browser-db/worker.ts`, `apps/plus/lib/change-sync.ts`.

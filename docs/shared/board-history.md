# 보드 Undo/Redo 상세설계

소스: `packages/ui/src/features/board/useBoardHistory.ts`, `packages/ui/src/features/board/BoardHistoryToolbar.tsx`, `packages/ui/src/features/board/useBoardPointerActive.ts`, `packages/ui/src/features/board/BoardClient.tsx`

## 이력의 범위

Free·Plus가 같은 이력 훅을 사용한다. 최근 50개 작업의 과거·현재·미래 `BoardContent`를 메모리에 보관한다. 새로고침 후 이력을 복원하지 않으며 SQLite·IndexedDB·Neon에 이력 스택을 저장하지 않는다.

| 포함 | 제외 |
| --- | --- |
| 메모·이미지·Mermaid·표·획 컬렉션 | 보드 메타데이터·스크롤·줌 |
| 내용·색·위치·크기·z·메모 순서 | 선택·편집·포커스·도구·열린 패널 |
| 생성·삭제·그룹 변경·Import·Reset | 인증·서버 revision·미전송/전송 중 큐 |

## 참조 공유와 동일성

배열 참조가 같으면 그대로 재사용한다. 새 배열은 같은 위치 객체의 필드들을 얕게 비교해 값이 같으면 이전 객체를 공유한다. 모든 항목이 같으면 배열도 이전 참조를 사용한다.

이미지 바이너리, 표 소스와 획 점 배열을 매번 깊은 복사하거나 JSON으로 직렬화하지 않는다. 입력 상태가 불변이라는 전제다. 파일·서버의 값 비교와는 목적이 다르므로 영속 동기화의 `diffBoardSnapshots`를 대체하지 않는다.

## 기록 시점

| 작업 | 기록 단위 |
| --- | --- |
| 임시 메모·Mermaid·표 | 편집 완료 후 양수 ID로 확정된 생성 |
| 이미지 추가 | 변환이 끝나 컬렉션에 추가된 상태 |
| 내용 편집 | 빈 보드 클릭으로 편집 완료 |
| 이동·리사이즈 | 각각의 Rnd 종료 콜백 |
| 레이어·메모 순서 | 해당 변경의 확정 상태 |
| 다중 카드 이동·삭제 | 한 번에 바뀐 전체 컬렉션 |
| 드로잉 | 획 하나의 종료 |
| 지우개 | 한 번의 입력이 끝난 최종 상태 |
| Import·Reset | 전체 내용을 교체한 한 작업 |

기록은 로컬·서버 저장 성공을 기다리지 않는다. `drawingInputActive`, 메모 정렬 드래그, 음수 ID 임시 카드, AI 제안·전송·수락 처리 중에는 기록을 보류하고 종료 시 최종 값을 본다. 문자 입력과 드로잉 포인터 이동 프레임은 독립 이력이 아니다.

이력 기록의 보류와 버튼 실행 차단은 별개다. 기존 카드의 위치·크기는 편집 중에도 종료 시 기록할 수 있지만 버튼은 편집을 마친 뒤에만 실행할 수 있다.

## Undo·Redo·초기화

- Undo는 현재를 미래 앞에 넣고 과거의 마지막 상태를 현재로 옮긴다.
- Redo는 미래의 첫 상태를 현재로 옮기고 이전 현재를 과거에 넣는다.
- 복원한 값이 현재 이력과 같으므로 관찰 효과가 복원 자체를 새 작업으로 추가하지 않는다.
- Undo 후 새로운 값이 확정되면 미래를 비운다. 값이 같은 갱신은 이력을 만들거나 미래를 지우지 않는다.
- 초기 서버 스냅샷이 교체되면 `resetHistory`와 화면 교체를 함께 실행한다.
- 보드 이동, 계정 전환의 재마운트, 서버 복원 화면의 재초기화, 새로고침은 이전 이력을 버린다.

## 화면 복원

`applyContent`가 네 카드 컬렉션과 획을 교체한다. `contentVersion`을 올려 카드·드로잉을 재마운트해 내부 초안과 표시 크기까지 맞춘다. 편집 ID·포커스·선택은 정리하지만 스크롤·줌과 도구 모드는 되돌리지 않는다.

이미지는 이력이 들고 있는 같은 `Uint8Array`에서 새 Blob URL을 만든다. 삭제 시 해제된 예전 URL을 재사용하지 않는다. 카드의 숫자 ID·`syncId`·`assetId`는 원래 값으로 복원하고, 신규 카드의 ID 발급은 현재 컬렉션과 이미지 ID 카운터를 기준으로 한다.

## 버튼과 포인터

`BoardHistoryToolbar`는 `fixed bottom-5 left-1/2`에 배치한다. `Undo2`·`Redo2`, 툴팁, 접근성 이름을 제공한다. 드로잉 툴바의 Undo도 같은 핸들러다.

이력이 없거나 편집 권한이 없으면 비활성화한다. 카드 편집, 포인터 입력, 정렬 드래그, 이미지 변환, AI 처리·제안 중에도 비활성화한다. 실행 핸들러는 열린 모달도 검사한다.

`useBoardPointerActive`는 보드 안에서 시작한 포인터 ID를 모으고 캡처 단계의 up/cancel/move와 blur로 정리한다. 레이어가 이벤트 전파를 막거나 입력이 보드 밖에서 끝나도 처리한다. Pencil 압력이 남아 있는 hover 이벤트는 종료로 보지 않는다.

획·지우개 묶음은 물리 포인터 집합이 아닌 `useDrawingPointer.onInteractionChange`로 구분한다. 손바닥·보조 터치가 펜의 서로 다른 작업을 하나로 합치지 않게 한다.

## 저장과 검증

복원 결과는 기존 `snapshot → useBoardPersistence → SQLite·IndexedDB` 경로를 따른다. Plus는 기존 동기화 계층에서 이를 새로운 변경분으로 만들고 서버 revision을 증가시킨다. 전송 큐·진행 중 요청을 되감지 않는다.

드로잉 모드의 영속 저장은 기존처럼 모드를 끝낸 뒤에 실행한다. 이력은 그 안에서도 기록하지만 새로고침 전 미저장 획의 영속화를 보장하는 기능은 아니다.

검증 파일:

- `packages/ui/tests/useBoardHistory.test.ts`: 모든 객체, 동일 값, 참조 공유, 50단계, 초기화, 저장 디바운스.
- `packages/ui/tests/useBoardPointerActive.test.tsx`: 전파 차단, 다중 포인터, 보드 밖 종료, hover, blur.
- `apps/free/tests/unit/cardHooks.test.ts`: 네 카드의 이동·리사이즈 완료 전달.
- `apps/free/tests/e2e/board-history.spec.ts`: 생성·내용·크기·위치·이미지·획·지우개·정렬·그룹·Import·Reset·재시작.
- `apps/plus/tests/e2e/board-delta.spec.ts`: Undo/Redo의 원격 revision 증가, 좌표 복원 시 바이너리 미재전송.

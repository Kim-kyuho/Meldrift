# BoardMenu 상세설계 (Plus)

소스: `apps/plus/components/BoardMenu.tsx`, `packages/ui/src/features/board/BoardMenu.tsx`

Free와 같은 공통 메뉴를 사용하고 Plus 브랜드와 인증 영역만 주입한다. 메뉴 열림 상태는 부모가 소유한다. 보드 화면에서는 공유 BoardClient의 `renderMenu`가 넘기는 `BoardMenuControls`를 그대로 펼쳐 넣는다.

## 공통 메뉴

보드 화면은 제목, Reorder Memos, Export, Import, Compile to Markdown, Reset, About을 표시한다. 제목은 공유 BoardClient가 넘기는 `title`이다. 보드 목록 화면은 `title`과 `boardActions`를 넘기지 않아 보드 작업 영역을 숨기고, 제목을 `Board List`로 바꿔 작게 표시한다. 보드 CRUD는 별도 목록 화면에서 처리한다.

파일 항목의 잠금과 동작은 공유 BoardClient 안의 [BoardControls](../shared/board-controls.md)가 `boardActions`로 계산해 넘긴다. 이 래퍼는 권한을 다시 판단하지 않는다. Export는 로그인 후, Import와 Reset은 로그인·승인된 편집 권한 및 현재 작업 가능 상태일 때 열린다.

Import는 현재 보드 메타데이터를 유지하면서 내용을 교체하고 복제한 객체에 새 동기화 ID를 부여한다. Reset은 현재 보드 내용만 비운다. 서버 revision과 계정 정보는 초기화하지 않는다. 두 작업 모두 공통 Undo/Redo 대상이다.

## Plus 인증 영역

- 비로그인: Sign-in, Sign-up. 선택하면 메뉴를 닫고 해당 모달을 연다.
- 로그인: 역할·이메일과 Sign-out. 로그아웃은 기존 인증 흐름을 사용한다.
- 로고: Plus 마스코트·워드마크·`+`를 표시한다.

UI 비활성화만으로 권한을 보장하지 않는다. 실제 작업 훅과 서버 API도 해당 권한을 검증한다.

관련 설계: [Free 메뉴](../free/board-shell.md), [공통 BoardClient](../shared/board-client.md), [보드 이력](../shared/board-history.md).

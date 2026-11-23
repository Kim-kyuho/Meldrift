# 보드 껍데기 상세설계 (Free)

소스: `app/layout.tsx`, `components/BoardMenu.tsx`, `packages/ui/src/shared/BoardMessage.tsx`, `packages/ui/src/features/board/AboutModal.tsx`

카드와 캔버스를 둘러싼 화면 요소다. Free·Plus가 같은 공통 메뉴와 About 구조를 사용하며 앱에서 브랜드·문구·인증 영역을 주입한다. Free에는 인증·서버 보드 목록·미리보기가 없다.

## `app/layout.tsx`

폰트·전역 CSS·Analytics 구성은 Plus와 같고 메타데이터 문구만 다르다. `basePath`가 없어 Free는 `/`에서 그대로 서비스된다.

## `BoardMenu`

`packages/ui/src/features/board/BoardMenu.tsx`를 `components/BoardMenu.tsx`가 감싸 브랜드만 더한다. Plus도 같은 공통 메뉴를 쓰고 인증 영역을 더한다. 보드 생성·이름 변경·삭제는 Plus 목록 화면의 별도 책임이다.

공유 BoardClient의 `renderMenu`가 넘기는 `BoardMenuControls`를 그대로 펼쳐 넣는다. 제목 `Free Board`는 `menuTitle`로 공유 BoardClient가 넘긴다.

| Props | 타입 | 역할 |
| --- | --- | --- |
| `menuOpen`/`setMenuOpen` | `boolean` / setter | 열림 상태 |
| `boardActions` | `BoardMenuActions` / 없음 | 보드 전용 항목의 상태와 동작. 없으면 그 영역을 숨긴다 |
| `onAbout` | `() => void` | About 열기 |
| `brand` | `ReactNode` | 왼쪽 위 로고. Free 래퍼가 넣는다 |
| `title` | `string` / 없음 | 머리 제목. `BoardMenuControls`에 들어 있다 |
| `titleDivider`, `compact`, `authControls` | 선택 | 구분선, 작은 크기, 인증 영역 |

항목은 위에서부터 다음과 같다. 잠금 조건은 `BoardControls`가 계산해 `boardActions`로 넘긴다. [BoardControls](../shared/board-controls.md)를 참조한다.

| 항목 | 잠기는 조건 |
| --- | --- |
| 메모 순서 | 없음 |
| Export (`.sqlite` 내보내기) | `exportDisabled` |
| Import (`.sqlite` 불러오기) | `importDisabled` |
| Markdown 컴파일 | 없음 |
| Reset (현재 보드 내용 비우기) | `resetDisabled` |
| About | 없음 |

`runAndClose(action)`은 메뉴를 먼저 닫고 동작을 실행한다. 모든 항목이 이 경로를 쓴다.

`exportPaused`일 때만 메뉴 아래에 `Finish editing before exporting.`를 덧붙인다. 버튼이 왜 잠겼는지 알려 주는 자리다.

About은 구분선 아래에 따로 둔다.

Reset은 DB 자체를 삭제하거나 새로고침하지 않으며 Import와 함께 Undo할 수 있다.

## `BoardToolBar`

두 Edition이 공유한다. [BoardToolBar 상세설계](../shared/board-tool-bar.md)를 참조한다.

`BoardZoomControl`은 `@meldrift/ui`에서 그대로 쓴다.

## `BoardMessage`

권한 메시지가 없다. Free에서 이 자리로 올라오는 문구는 저장 실패, 이미지 처리 실패, 반출입 실패, 메모 탐색 안내다.

Plus와 마찬가지로 화면 상단에 띄우고 일정 시간 뒤 자동으로 닫으며, 빈 문자열이면 아무것도 렌더링하지 않는다.

## `AboutModal`

구조는 Plus와 같고 소개 문구와 링크만 Free 기준이다. `BoardMenu`의 About 항목으로 열리고 `document.body`에 포탈로 그린다. 외부 링크는 새 탭으로 연다.

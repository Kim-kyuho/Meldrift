# 보드 껍데기 상세설계 (Free)

소스: `app/layout.tsx`, `components/BoardMenu.tsx`, `components/BoardToolBar.tsx`, `components/BoardMessage.tsx`, `components/AboutModal.tsx`

카드와 캔버스를 둘러싼 화면 요소다. Plus와 이름이 같지만 담는 항목이 다르다. 인증·보드 목록·미리보기가 없고, 대신 세이브 파일 조작이 들어온다.

## `app/layout.tsx`

폰트·전역 CSS·Analytics 구성은 Plus와 같고 메타데이터 문구만 다르다. `basePath`가 없어 Free는 `/`에서 그대로 서비스된다.

## `BoardMenu`

Plus의 보드 메뉴에 있던 로그인·회원가입·보드 목록·보드 이름 변경·삭제가 전부 없다. 대신 세이브 파일 항목이 들어간다.

| Props | 타입 | 역할 |
| --- | --- | --- |
| `menuOpen`/`setMenuOpen` | `boolean` / setter | 열림 상태 |
| `exportDisabled` | `boolean` | 내보내기 잠금 |
| `transferring` | `boolean` | 반출입 진행 중 |
| `resetting` | `boolean` | 리셋 진행 중 |
| `reorderOpen` | `boolean` | 순서 패널 열림 표시 |
| `onReorder`/`onExport`/`onImport`/`onCompileMarkdown`/`onReset`/`onAbout` | `() => void` | 항목 동작 |

항목은 위에서부터 다음과 같다. 머리에 `Free Edition` 라벨이 붙는다.

| 항목 | 잠기는 조건 |
| --- | --- |
| 메모 순서 | 없음 |
| Export (`.sqlite` 내보내기) | `exportDisabled \|\| transferring \|\| resetting` |
| Import (`.sqlite` 불러오기) | `transferring \|\| resetting` |
| Markdown 컴파일 | 없음 |
| Reset (브라우저 데이터 삭제) | `transferring \|\| resetting` |
| About | 없음 |

`runAndClose(action)`은 메뉴를 먼저 닫고 동작을 실행한다. 모든 항목이 이 경로를 쓴다.

`exportDisabled`일 때만 메뉴 아래에 `Finish editing before exporting.`를 덧붙인다. 버튼이 왜 잠겼는지 알려 주는 자리다.

About은 구분선 아래에 따로 둔다.

## `BoardToolBar`

| Props | 역할 |
| --- | --- |
| `cardEditing`, `drawingMode` | 툴바를 숨길지 판정 |
| `searchBarOpen`, `boardNavigatorOpen` | 패널 토글 상태 |
| `boardZoom`, `setBoardZoom` | `BoardZoomControl`에 전달 |
| `setMenuOpen`, `setSearchBarOpen`, `setBoardNavigatorOpen` | 패널 열기 |
| `onMemoCreateClick`, `onImageUploadClick`, `onMermaidCreateClick`, `onTableCreateClick` | 카드 추가 |
| `onDrawingToggleClick` | 드로잉 모드 토글 |

Plus의 툴바에 있던 인증 관련 props와 권한에 따른 잠금이 없다. 카드 추가 네 개가 항상 열려 있다.

`BoardZoomControl`은 `@meldrift/ui`에서 그대로 쓴다.

## `BoardMessage`

권한 메시지가 없다. Free에서 이 자리로 올라오는 문구는 저장 실패, 이미지 처리 실패, 반출입 실패, 메모 탐색 안내다.

Plus와 마찬가지로 화면 상단에 띄우고 일정 시간 뒤 자동으로 닫으며, 빈 문자열이면 아무것도 렌더링하지 않는다.

## `AboutModal`

구조는 Plus와 같고 소개 문구와 링크만 Free 기준이다. `BoardMenu`의 About 항목으로 열리고 `document.body`에 포탈로 그린다. 외부 링크는 새 탭으로 연다.

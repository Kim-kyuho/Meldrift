# Markdown 임포트 상세설계

소스: `packages/board-data/src/board-markdown-import.ts`, `packages/ui/src/features/board/board-import-kind.ts`, `packages/ui/src/features/markdown/BoardMarkdownImporter.tsx`, `packages/ui/src/features/board/BoardControls.tsx`

## 목적

기존 `Compile to Markdown`([markdown-export.md](./markdown-export.md))의 역방향으로, `.md` / `.markdown` 파일을 불러와 ATX 헤딩(`#`~`######`) 단위 메모 카드와 표(Table)·Mermaid 카드로 자동 변환·배치한다.

## 관심사의 분리

단일 `Import` 메뉴([BoardMenu.tsx](../../packages/ui/src/features/board/BoardMenu.tsx))와 단일 파일 입력(`<input aria-label="Import board database">`)을 유지하되, 내부 처리는 4개 계층으로 완전히 분리한다.

1. **포맷 판별 (`board-import-kind.ts`)**: 파일 앞 16바이트의 SQLite 매직 헤더(`"SQLite format 3\0"`)를 우선 확인하고, 아니면 확장자(`.md`, `.markdown`, `.mdown`, `.mkd`)·MIME(`text/markdown`)으로 `"markdown"`과 `"sqlite"`를 분기한다.
2. **SQLite 전담 (`useBoardFileTransfer.ts`)**: SQLite 파일 읽기·검증·내보내기·초기화만 담당하며 Markdown 로직을 포함하지 않는다.
3. **Markdown 전담 컴포넌트 (`BoardMarkdownImporter.tsx`)**: 선택된 `.md` 파일 크기 제한(2 MiB), UTF-8 디코딩, `importMarkdownToBoard` 호출, 기존 콘텐츠 존재 시 `ConfirmDialog` 요약 확인, `onCommit` / 에러 메시지 전달을 독립적으로 관리한다.
4. **순수 파싱·배치 계층 (`board-markdown-import.ts`)**: DOM·React에 의존하지 않는 순수 TypeScript 파이프라인.

## 변환 및 배치 규칙

- **메모 분리**: 펜스 코드 블록(`` ``` `` / `~~~`) 밖의 ATX 헤딩(`#`~`######`)마다 새 메모 카드를 생성하고 순서대로 `sortOrder = 1, 2, ...`를 부여한다.
- **표 추출**: GFM 파이프 표(헤더 + 구분선 + 본문 행)를 추출해 `tableSourceSchema`로 검증한다(`\|`, `<br>` 언이스케이프).
- **Mermaid 추출**: 언어 태그가 `mermaid`인 닫힌 펜스 블록을 `BoardMermaid`로 추출한다. 일반 코드 블록은 메모 본문에 유지한다.
- **HTML 변환 및 보안**: 남은 메모 Markdown은 `@meldrift/markdown-engine`의 `compileMarkdown()`으로 변환해 모든 원시 HTML을 이스케이프한다.
- **50px 코너 연결 배치**:
  - 첨부 수(1~4개)에 따라 `TR`, `TR/BR`, `TR/BL/BR`, `TL/TR/BL/BR` 슬롯에 24px 간격(`<= cornerLinkRadius(50px)`)으로 비겹침 배치해 `compileBoardMarkdown`의 `TL → TR → BL → BR` 순서와 100% 일치시킨다.
  - 한 섹션에 첨부가 5개 이상이면 4개 단위로 연속 메모 카드(`<제목> (2)`)를 자동 분할해 모든 카드를 연결한다.
  - 섹션 간 세로·열 간격은 80px(`> 50px`)로 유지해 타 메모와의 오연결을 방지한다.
- **저장 및 이력**: `BoardMarkdownImporter`가 `onCommit(snapshot)`을 호출하면 `BoardControls`의 `replaceBoard`가 즉시 `flushSave()`를 실행하고 `useBoardHistory`가 단일 이력으로 기록해 Undo 복원을 지원한다.

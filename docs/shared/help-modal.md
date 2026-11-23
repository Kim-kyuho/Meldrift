# Help 상세설계

소스: `packages/ui/src/features/guide/HelpModal.tsx`, `HelpCanvasMenu.tsx`, `HelpOverlay.tsx`, `board-guide.ts`, `useHelpShortcut.ts`, `packages/ui/src/features/board/BoardClient.tsx`

## 목적

새 보드에 처음 들어왔을 때 무엇을 할 수 있는지 알려 준다. Free·Plus가 같은 컴포넌트를 쓰고, 문서 경로와 마스코트 경로만 앱이 `BoardGuide`로 넘긴다.

```ts
type BoardGuide = {
    key: string;
    helpMarkdownUrl: string;
    helpShortcutsUrl: string;
    mascotUrl: string;
};
```

| 앱 | 구현 | 값 |
| --- | --- | --- |
| Free | `apps/free/lib/board-guide.ts` | `key: "free"`, `/help/Help_Meldrift.md`, `/help/Help_Shortcuts.md`, `/meldrift-mascot.png` |
| Plus | `apps/plus/lib/board-guide.ts` | `key: "plus"`, `/plus/help/Help_Meldrift.md`, `/plus/help/Help_Shortcuts.md`, `/plus/meldrift-mascot.png` |

Help 문서는 앱마다 따로 둔다. 저장 방식 안내(`Free Edition Storage` / `Meldrift+ Storage`)와 단축키 문서의 판 이름만 다르고 나머지는 같다. 문서 안 이미지 경로도 각 앱의 `public/help/` 기준이다.

공유 BoardClient에 `guide`를 넘기지 않으면 Help와 튜토리얼이 모두 꺼진다.

## 여는 경로

| 경로 | 조건 |
| --- | --- |
| 자동 | 새 보드에 처음 들어왔을 때 한 번 |
| 단축키 | `Ctrl`/`⌘` + `Shift` + `P` |
| Help 종료 후 메뉴 | `HelpCanvasMenu`의 `Help` 버튼 |

### 새 보드 첫 진입 판정

`isNewBoardEntry(guide, snapshot)`이 판정한다.

```text
새 보드 = 내용이 모두 비어 있음(isBoardContentEmpty)
        && localStorage에 meldrift:board-entered:{guide.key}:{boardId} 기록이 없음
```

- 공유 BoardClient가 마운트될 때 한 번 판정하고, 판정 결과와 상관없이 `recordBoardEntry`로 기록을 남긴다. 그래서 내용이 있는 보드를 한 번 연 뒤 나중에 비워도 다시 자동으로 열지 않는다.
- 기록은 브라우저별, 앱(`guide.key`)별, 보드별이다. Free와 Plus가 같은 출처에서 돌아도 서로의 기록을 쓰지 않는다.
- `localStorage`를 쓸 수 없으면 새 보드로 보지 않는다. 자동으로 열지 않는 쪽이 안전하다.
- 튜토리얼에서 돌아온 뒤에는 자동으로 열지 않는다.

`isBoardContentEmpty`는 메모·이미지·머메이드·표·획이 **모두** 비어 있을 때만 참이다. 보드 제목이나 크기는 보지 않는다.

단축키 리스너(`useHelpShortcut`)는 `window`에 **캡처 단계**로 붙인다(`addEventListener(..., true)`). 메모 편집기가 키 이벤트를 먼저 삼키더라도 Help가 열린다. Help를 열 때는 `closeOverlays()`로 메뉴·About·Markdown 뷰를 먼저 닫아 겹쳐 뜨지 않게 한다.

## 문서 로딩

두 개의 탭(`Introduce`, `Short-cut`)으로 나뉜다.

| 탭 | URL | 내용 |
| --- | --- | --- |
| `Introduce` | `guide.helpMarkdownUrl` | Meldrift 개념, Mermaid 흐름도, 카드 타입 표, 50px 연결 규칙, 저장 방식 안내 |
| `Short-cut` | `guide.helpShortcutsUrl` | 전역/모달, 캔버스 모드·카드 생성, Memo Markdown 에디터, Table 그리드 단축키 |

- 선택된 탭의 문서를 처음 열 때 `fetch`로 받아 상태(`docs`)에 캐시한다. 재전환 시 다시 요청하지 않는다.
- 응답이 `ok`가 아니면 `The Help document could not be loaded.`를 본문 자리에 붉게 표시한다.
- 언마운트 또는 탭 전환 시 `AbortController`로 취소한다. `AbortError`는 오류로 취급하지 않는다.
- 아직 본문이 없으면 `Loading Help...`를 표시한다.

받은 Markdown은 `splitMermaidSections`로 `mermaid` 코드 블록을 분리해 `MermaidDiagramView`로 렌더링하고, 일반 본문은 `remark-gfm` + `rehype-raw` + `rehype-sanitize`로 렌더링한다. 문서에 든 HTML을 살리되 sanitize를 반드시 통과시킨다.

## 단축키 표기

`getHelpShortcut(userAgent)`가 플랫폼에 맞는 라벨을 만든다.

| 판정 | 라벨 | aria-label |
| --- | --- | --- |
| `Macintosh|Mac OS X|iPhone|iPad|iPod` | `⌘ ⇧ P` | `Help shortcut: Command Shift P` |
| 그 외 | `Ctrl ⇧ P` | `Help shortcut: Control Shift P` |

`navigator`가 없는 환경에서는 빈 문자열을 넘겨 기본(Ctrl) 표기가 나온다.

## 렌더 구조

`document.body`에 포탈로 그린다. 뒤 배경은 `z-index: 60000`, 대화상자는 `60001`로 다른 카드(`ACTIVE_CARD_Z = 49999`)보다 위다.

- 배경 클릭과 `Escape`로 닫는다.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="help-title"`.
- 크기는 `min(64rem, 100vw-2rem)` × `min(52rem, 100dvh-2rem)`이고 본문만 스크롤한다.
- 헤더에 제목과 단축키 `<kbd>`, 닫기 버튼이 있다.

## 종료 후 캔버스 메뉴

모달을 닫으면(`onClose`) `HelpOverlay`가 캔버스 상단에 영어 퀵 메뉴(`HelpCanvasMenu`)를 띄운다. 보드 메뉴, 메모 순서 패널, 카드 편집, Markdown 미리보기 중 하나라도 열려 있으면 숨긴다(`launcherAllowed`). `Tutorial`로 샌드박스 튜토리얼을 시작하거나, `Help`로 모달을 다시 열거나, `Close (Esc)`·`Escape` 키로 닫을 수 있다. 세부 구조는 [인터랙티브 튜토리얼](./interactive-tutorial.md)을 참조한다.

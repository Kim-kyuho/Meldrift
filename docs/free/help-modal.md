# Help 상세설계

소스: `components/HelpModal.tsx`, `lib/help.ts`, `components/BoardClient.tsx`

## 목적

Free Edition은 로그인도 안내 화면도 없이 바로 보드로 들어간다. 처음 열었을 때 무엇을 할 수 있는지 알려 줄 곳이 필요해서 Help 문서를 모달로 띄운다.

## 여는 경로

| 경로 | 조건 |
| --- | --- |
| 자동 | 브라우저 DB를 읽은 결과가 빈 보드일 때 한 번 |
| 단축키 | `Ctrl`/`⌘` + `Shift` + `H` |
| 메뉴 | 보드 메뉴의 Help 항목 |

자동 열기는 `isBoardContentEmpty(stored)`로 판정한다. 메모·이미지·머메이드·표·획이 **모두** 비어 있을 때만 참이다. 보드 제목이나 크기는 보지 않는다.

단축키 리스너는 `window`에 **캡처 단계**로 붙인다(`addEventListener(..., true)`). 메모 편집기가 키 이벤트를 먼저 삼키더라도 Help가 열린다.

## 문서 로딩

`helpMarkdownUrl`은 `/help/Help_Meldrift.md`다. 모달이 마운트되면 `fetch`로 받아 온다.

- 응답이 `ok`가 아니면 `The Help document could not be loaded.`를 본문 자리에 붉게 표시한다.
- 언마운트 시 `AbortController`로 취소한다. `AbortError`는 오류로 취급하지 않는다.
- 아직 본문이 없으면 `Loading Help...`를 표시한다.

받은 Markdown은 `remark-gfm` + `rehype-raw` + `rehype-sanitize`로 렌더링한다. 문서에 든 HTML을 살리되 sanitize를 반드시 통과시킨다.

## 단축키 표기

`getHelpShortcut(userAgent)`가 플랫폼에 맞는 라벨을 만든다.

| 판정 | 라벨 | aria-label |
| --- | --- | --- |
| `Macintosh|Mac OS X|iPhone|iPad|iPod` | `⌘ ⇧ H` | `Help shortcut: Command Shift H` |
| 그 외 | `Ctrl ⇧ H` | `Help shortcut: Control Shift H` |

`navigator`가 없는 환경에서는 빈 문자열을 넘겨 기본(Ctrl) 표기가 나온다.

## 렌더 구조

`document.body`에 포탈로 그린다. 뒤 배경은 `z-index: 60000`, 대화상자는 `60001`로 다른 카드(`ACTIVE_CARD_Z = 49999`)보다 위다.

- 배경 클릭과 `Escape`로 닫는다.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="help-title"`.
- 크기는 `min(64rem, 100vw-2rem)` × `min(52rem, 100dvh-2rem)`이고 본문만 스크롤한다.
- 헤더에 제목과 단축키 `<kbd>`, 닫기 버튼이 있다.

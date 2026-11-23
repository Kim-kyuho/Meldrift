# 인터랙티브 튜토리얼 상세설계

소스: `packages/ui/src/features/board/BoardClient.tsx`, `packages/ui/src/features/board/BoardWorkspace.tsx`, `packages/ui/src/features/guide/HelpOverlay.tsx`, `HelpCanvasMenu.tsx`, `TutorialGuide.tsx`, `TutorialOverlay.tsx`, `tutorial.ts`

## 목적

처음 접속한 유저에게 Meldrift의 핵심 사용 흐름(카드 작성, 50px 코너 연결, Markdown 컴파일 및 메모 순서 변경)을 실제 조작으로 익히게 하되, 기존 유저의 보드 작업이나 저장 데이터를 방해하지 않는다. Free·Plus가 같은 코드를 쓰며, 공유 BoardClient에 `guide`를 넘기면 켜진다.

## 진입 조건과 캔버스 런처

- 기존 유저 보호: Help는 [새 보드 첫 진입](./help-modal.md#새-보드-첫-진입-판정)에만 자동으로 열린다. 내용이 있는 보드나 이미 열어 본 보드에서는 Help와 튜토리얼 모두 자동으로 띄우지 않는다.
- `HelpModal`이 닫히면(`onClose`) `HelpOverlay`가 런처를 열어 캔버스 상단에 영어 메뉴 바(`HelpCanvasMenu`)를 띄운다. 보드 메뉴, 메모 순서 패널, 카드 편집, Markdown 미리보기가 열려 있을 때는 `BoardWorkspace`가 계산한 `launcherAllowed`로 숨기고, 스택 순서도 `z-49999`로 두어 다른 보드 UI나 모바일 우상단 AI 어시스턴트 버튼을 가리지 않도록 모바일에서는 좌측(`left-4 top-17`)에 콤팩트하게 배치한다.

| 버튼 | 동작 |
| --- | --- |
| `Tutorial` | 런처를 닫고 현재 스냅샷을 복귀 지점으로 보관한 뒤 샌드박스 튜토리얼로 전환한다 |
| `Help` | 런처를 닫고 `HelpModal`을 다시 연다 |
| `Close (Esc)` | 런처를 닫는다 (`window`의 `Escape` 키 입력도 동일하게 닫는다) |

`HelpCanvasMenu`와 `TutorialOverlay`는 모두 `.board-toolbar` 클래스를 포함해, 카드 편집 중 버튼을 눌러도 빈 보드 바깥 클릭 저장 판정과 충돌하지 않는다.

## 샌드박스 격리 구조

```text
BoardClient (packages/ui)
├─ 튜토리얼 아님 → BoardWorkspace key="board"
│                  initialSnapshot = 복귀 지점이 있으면 그 스냅샷, 없으면 앱이 넘긴 initialSnapshot
│                  storage·viewportRef·collaboration = 앱이 넘긴 값, help = HelpOverlay
└ 튜토리얼 중   → BoardWorkspace key="tutorial"
                   initialSnapshot = createTutorialSandboxSnapshot(), storage·collaboration·viewportRef 없음
                   tutorial = TutorialGuide + 4단계의 TutorialLinkZones
```

- 일반 보드와 튜토리얼 보드를 동시에 마운트하지 않고 배타적으로 전환해 전역 키보드 단축키, `#card-tool-portal`, `.board-scroll-layer` 포인터 리스너 충돌을 막는다.
- 튜토리얼 보드에는 `storage`를 넘기지 않는다. 그래서 저장하지 않고, `BoardControls`가 메뉴의 `Export`·`Import`·`Reset`을 잠근다. Plus에서도 Live 연결(`collaboration`)과 미리보기 캡처 대상(`viewportRef`)을 넘기지 않는다.
- 메뉴는 앱의 `renderMenu`를 그대로 쓴다. 메뉴 제목은 샌드박스 보드 제목(`Meldrift Tutorial Sandbox`)이다.
- 복귀 지점은 튜토리얼을 시작할 때의 화면 상태다. 앱이 넘긴 `initialSnapshot`이 그 사이 바뀌면(Plus 서버 상태 복원 등) 복귀 지점을 버리고 새 값을 쓴다.
- 복귀할 때는 저장소의 `skipInitialSave`를 끄고 다시 마운트한다. 튜토리얼 직전까지 저장되지 않았던 변경도 첫 저장으로 남는다.
- 튜토리얼에서 돌아오면 Help를 다시 자동으로 열지 않는다.

## 6단계 진행 흐름 (`TUTORIAL_STEPS`)

| 단계 | 제목 | 안내 및 자동 판정 |
| --- | --- | --- |
| 1 | `Create & Edit a Memo Card` | 메모 생성(`create-memo` / `m`), Markdown 입력, 빈 보드 클릭 저장을 유도한다 (`memos.length > 0` 및 `!isEditing && id > 0 && content.trim()`) |
| 2 | `Create Table & Mermaid Cards` | Table(`t`)·Mermaid(`d`) 카드 생성·저장을 유도하고, 로컬 파일에 의존하는 Image 카드는 텍스트로만 설명한다 |
| 3 | `Meldrift Showcase Board` | 최초 진입 시 `buildTutorialShowcaseSnapshot`으로 Memo 2개(`#1`, `#2`), Image(`guide.mascotUrl`), Table, Mermaid 카드를 자동 생성하고 `Restore Showcase` 복원 버튼을 제공한다 |
| 4 | `50px Memo Corner Linking` | `TutorialLinkZones`가 보드 캔버스 안에서 모든 메모의 네 모서리에 `r={cornerLinkRadius}`(50px) 분홍 점선 원과 `50px Link Zone` 라벨을 표시하고, 실시간 `cornerLinks.length`를 보여 준다 |
| 5 | `Compile to Markdown & Download` | `...` → `Compile to Markdown` 실행 여부를 추적(`markdownViewOpen`)하고, 미리보기 우측 상단 `Download Markdown` 버튼(`.md`/이미지 포함 `.zip`)을 안내한다 |
| 6 | `Reorder Memos & Re-Compile` | 진입 시 `getMemoOrderKey(snapshot.memos)`를 기준선으로 기록하고, `Reorder Memos`로 순서 변경 후 다시 `Compile to Markdown`을 열면 완료 상태로 전환한다 |

### Step 3 쇼케이스 배치

- 뷰포트 중앙(`viewportRef` 스크롤·배율 기준)에 맞춰 배치하며, 상단 튜토리얼 카드와 겹치지 않도록 `y >= 210`을 하한으로 둔다.
- Memo `#1`의 우상단(25px 거리)에 Image, 좌하단(28px 거리)에 Table, Memo `#2`의 좌하단(27px 거리)에 Mermaid 카드를 비겹침 거리(`<= 50px`)로 배치해 진입 직후 코너 연결 점선과 Markdown 컴파일 결과를 바로 확인할 수 있게 한다.
- `loadTutorialMascotBytes(guide.mascotUrl)`가 마스코트 바이트를 읽어 이미지 카드에 채워 ZIP 다운로드까지 동작하며, 오프라인/실패 시에는 `data: null` + `url: guide.mascotUrl` 폴백을 사용한다.

## 시각 강조와 Markdown 미리보기 대응

- **패딩 글로우 강조**: `TutorialOverlay`는 단계별 `highlightTargets`(`[data-tutorial="..."]`)에 외곽 보더 대신 버튼 내부 패딩 배경과 인셋 글로우(`meldriftTutorialPaddingGlow`: `background-color` + `inset 0 0`)가 깜빡이도록 스타일을 주입한다(`prefers-reduced-motion` 시 정적 틴트로 대체).
- **Markdown 미리보기 중 가이드**: `BoardMarkdownPreview`가 `document.body` 포털(`zIndex: 60000/60001`)로 뜨므로, `markdownViewOpen === true`일 때 `TutorialOverlay`도 `document.body` 포털(`zIndex: 60002`) 하단 카드로 전환해 미리보기 헤더·`Download Markdown`·닫기 버튼을 가리지 않고 접기/펼치기와 `Exit` 레이아웃을 유지한다.
- **버튼 레이아웃 주의**: `HelpCanvasMenu`와 `TutorialOverlay`의 버튼은 `.ui-button-menu`(`display: block; width: 100%`)를 쓰지 않고 인라인 플렉스 `<button>`으로 렌더링해 플렉스 행 내부 문구 영역이 눌리지 않게 유지한다.

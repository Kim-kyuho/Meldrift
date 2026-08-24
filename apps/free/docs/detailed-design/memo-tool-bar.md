# MemoToolBar 상세설계

소스: `components/MemoToolBar.tsx`, `hooks/useMemoToolBar.ts`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `onChangeColor` | `(color: string) => void` | `useMemoToolBar`에 전달, 색상 선택 시 |
| `onHeading` | `(level: 1\|2\|3\|4\|5\|6) => void` | `useMemoToolBar`에 전달, 제목 레벨 선택 시 |
| `onBold`/`onItalic`/`onStrike`/`onHighlight` | `() => void` | format 모드 각 버튼 (152, 155, 158, 161줄) |
| `onHorizontalRule`/`onCodeBlock`/`onBlockQuote` | `() => void` | block 모드 각 버튼 (172, 175, 178줄) |
| `onBringToFront`/`onSendToBack`/`onDelete` | `() => void` | main 모드 레이어/삭제 버튼 (113, 116, 119줄) |

이 컴포넌트는 실제 Tiptap 명령을 실행하지 않는다 — 모든 서식 콜백은 호출자(`MemoCard`)가 에디터 인스턴스와 연결해서 넘겨준다.

## `useMemoToolBar` State (10~12줄)

| State | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `openMemoColorMenu` | `false` | `toggleColorMenu`, `handleColorSelect`(선택 후 닫기), `changeToolMode`(모드 전환 시 강제 닫기) | 색상 팝업 렌더 조건(91줄) |
| `openHeadingMenu` | `false` | `toggleHeadingMenu`, `handleHeadingSelect`, `changeToolMode` | 제목 팝업 렌더 조건(134줄) |
| `toolMode` | `"main"` | `changeToolMode("main"\|"format"\|"block")` | 렌더할 버튼 그룹 결정 |

색상/제목 두 팝업도 상호 배타적이다(`toggleColorMenu`가 `openHeadingMenu`를 강제로 닫고, 그 반대도 동일 — 30~38줄).

## 모드별 도구 구성 (85~182줄)

| `toolMode` | 표시 도구 |
| --- | --- |
| `"main"` (85줄) | Memo color(팔레트+팝업), Text formatting(→format 진입), Block formatting(→block 진입), Bring to front, Send to back, Delete(rose) |
| `"format"` (125줄) | Back to memo tools(→main 복귀), Heading(H1~H6 팝업), Bold, Italic, Strike, Highlight |
| `"block"` (167줄) | Back to memo tools, Divider, Code block, Block quote |

`changeToolMode(mode)` (50~54줄)는 모드를 바꾸기 전에 두 팝업을 모두 닫는다 — 예: format 모드에서 Heading 팝업을 열어둔 채 "Back"을 눌러도 main으로 돌아가면서 팝업 상태가 초기화된다.

## 서브 메뉴 데이터

| 메뉴 | 옵션 |
| --- | --- |
| `memoColors` (14~19줄) | Yellow `#fffadc`, Pink `#ffe4ec`, Blue `#e0f2fe`, Green `#dcfce7` |
| `headingLevels` (21~28줄) | h1~h6, `headingIcons`(MemoToolBar.tsx 44~51줄)로 각 레벨을 `Heading1`~`Heading6` 아이콘에 매핑 |

## 렌더 구조 세부

- `CardToolPortal animate={false}` (83줄) — 다른 툴바들과 달리 포탈 자체의 `toolbar-reveal` 애니메이션을 끄고, 내부 `div`에 `key={toolMode}`를 줘서(84줄) **모드가 바뀔 때마다 그 div를 새로 마운트시켜 `toolbar-reveal` 애니메이션을 수동으로 재생**시킨다(`card-tool-portal.md`의 "MemoToolBar는 animate=false를 쓴다" 설명의 실제 구현).
- 색상/제목 팝업은 둘 다 `absolute right-full top-0 mr-2`로 버튼 왼쪽에 가로로 펼쳐진다.

## 알려진 특이사항

- `useMemoToolBar`의 `onChangeColor`/`onHeading` 파라미터 타입은 옵셔널(`?`)이지만, `MemoToolBarProps`에서는 필수로 선언되어 있다 — 훅 자체는 재사용을 고려해 더 관대하게 타입을 잡아둔 것으로 보인다.
- 이 컴포넌트는 순수하게 "어떤 모드에서 어떤 버튼을 보여줄지"만 관리하고, Tiptap 편집 상태(예: 현재 커서 위치가 실제로 h2인지)는 전혀 추적하지 않는다 — 버튼에 활성/비활성(눌린 상태) 표시가 없다.

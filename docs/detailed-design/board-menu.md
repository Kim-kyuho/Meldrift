# BoardMenu 상세설계

소스: `components/BoardMenu.tsx`

## Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `menuOpen` | `boolean` | 드롭다운 표시 조건 (78줄) |
| `currentBoard` | `{ title: string } \| undefined` | `currentBoard?.title`이 있을 때만 제목/Reorder/Compile 항목 노출 (80줄) |
| `setMenuOpen` | `Dispatch<SetStateAction<boolean>>` | Ellipsis 버튼 토글(75줄), 보드 제목 클릭(84줄), Reorder 클릭(95줄), Compile 클릭(106줄), Sign-in/Sign-up 클릭(134, 142줄), About 클릭(154줄)에서 `false`로 닫기 |
| `setSignInOpen` | `Dispatch<SetStateAction<boolean>>` | Sign-in 버튼 클릭 시 `true` (135줄) |
| `setSignUpOpen` | `Dispatch<SetStateAction<boolean>>` | Sign-up 버튼 클릭 시 `true` (143줄) |
| `currentUser` | `CurrentUser \| null` | 로그인/비로그인 분기 (115줄) |
| `onSignOut` | `() => void` | "Sign-out" 버튼 `onClick` (125줄) |
| `reorderOpen` | `boolean \| undefined` | "Reorder Memos" 항목의 `aria-pressed` (93줄). 보드 목록 화면에서는 넘기지 않는다 |
| `onReorder` | `(() => void) \| undefined` | "Reorder Memos" 클릭 시 메뉴를 닫고 옵셔널 체이닝으로 호출 (96줄) |
| `onCompileMarkdown` | `(() => void) \| undefined` | "Compile to Markdown" 클릭 시 `setMenuOpen(false)` 후 옵셔널 체이닝으로 호출 (107줄) |
| `onAbout` | `() => void` | 최하단 "About" 클릭 시 메뉴를 닫고 About 모달을 연다 (155줄) |

## State

없음 — `menuOpen`을 포함한 모든 상태는 부모(`BoardClient`)가 소유하고, 이 컴포넌트는 setter만 받아 조작한다.

## 렌더 구조 (40~163줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| Meldrift 로고 `Link` (43줄) | 항상 | 마스코트·워드마크·`+` 표시, `aria-label="Meldrift home"`, `href="/"`, `fixed left-5 top-5`, `z-50000`, 터치 콜아웃/선택 비활성화 |
| Ellipsis 토글 버튼 (73줄) | 항상 | `fixed right-5 top-5`, `z-50000`, 클릭 시 `setMenuOpen(prev => !prev)` |
| 드롭다운 패널 (79줄) | `menuOpen`이 true일 때만 | `fixed right-5 top-17`, `z-50001` |
| 보드 제목 항목 (82줄) | `currentBoard?.title`이 있을 때만 | 클릭해도 콜백 없이 메뉴만 닫힘(표시 전용) |
| "Reorder Memos" 항목 (89줄) | `currentBoard?.title`이 있을 때만 | 메뉴 닫고 `onReorder?.()`, `ListOrdered` 아이콘, `text-emerald-600`. 메모 순서 패널을 열고 닫는다 |
| "Compile to Markdown" 항목 (102줄) | `currentBoard?.title`이 있을 때만 | 메뉴 닫고 `onCompileMarkdown?.()`, `FileText` 아이콘 사용 |
| 로그인 정보 블록 (116줄) | `currentUser`가 truthy | `[{role}]`과 이메일 표시, "Sign-out" 버튼 |
| Sign-in/Sign-up 블록 (130줄) | `currentUser`가 falsy | 두 버튼 각각 메뉴를 닫고 대응 모달 오픈 상태를 true로 |
| "About" 항목 (150줄) | 메뉴가 열리면 항상 | 인증 영역 아래 최하단에 표시, `Info` 아이콘 사용 |

## 알려진 특이사항

- 보드 제목 항목(82~88줄)은 클릭 이벤트가 있지만 실질 동작은 "메뉴 닫기"뿐이다 — 시각적으로는 버튼이라 클릭 가능해 보이지만 표시 그 이상의 기능이 없다.
- `onCompileMarkdown`과 `onReorder`가 없는 화면(보드 목록 등)에서도 `currentBoard?.title`만 있으면 두 항목이 노출될 수 있는 구조이나, 실제로는 조건들이 항상 같이 전달되는지는 호출자(`BoardClient`) 쪽 구현에 달려 있다. 두 콜백 모두 옵셔널 체이닝으로 호출하므로 눌러도 오류는 나지 않는다.

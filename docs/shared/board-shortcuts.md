# 보드 단축키 상세설계

소스: `packages/ui/src/features/board/useBoardShortcuts.ts`, `packages/ui/src/features/board/BoardClient.tsx`

Free·Plus 공통 단축키다. Fn 키 조합이 아닌 영문 소문자·숫자 단독 입력을 사용한다.

| 키 | 동작 |
| --- | --- |
| `1` | 선택 모드 토글. 다시 누르면 패닝 |
| `2` | 드로잉 모드 토글. 다시 누르면 패닝 |
| `m` | 임시 메모 생성 |
| `i` | 이미지 파일 선택창 열기 |
| `t` | 임시 표 생성 |
| `d` | 임시 Mermaid 생성 |

## 툴바와 같은 동작

모드 전환은 툴바와 같은 권한 검사·핸들러를 사용한다. 드로잉을 켜면 선택을 끄고, 선택을 켜면 드로잉을 끝낸다. 검색·탐색 패널과 메뉴도 닫는다. 보류 중 AI 변경이 있으면 선택 모드 진입을 거절한다.

카드 생성은 드로잉 중이거나 그룹이 선택된 상태에서는 등록하지 않는다. 카드 편집 중에는 모든 공통 단축키를 막는다. 이미지 키는 파일을 자동 생성하지 않고 사용자의 파일 선택을 기다린다.

## 입력 보호

- 카드 편집, 메뉴, About·Markdown·메모 정렬·AI 패널이 열린 동안 훅을 비활성화한다.
- 이벤트 대상과 현재 포커스가 input, textarea, select, contenteditable 또는 CodeMirror 안이면 무시한다.
- `Ctrl`, `Meta`, `Alt`, `Shift` 조합, 키 반복, IME 조합과 이미 처리된 이벤트는 무시한다.
- `aria-modal=true` 또는 열린 dialog가 있으면 배경 보드를 조작하지 않는다.
- 등록된 명령만 기본 키 동작을 막고 실행한다. 갱신·언마운트 시 리스너를 해제한다.

Free의 Help 단축키 Ctrl/⌘ + Shift + H는 앱의 별도 훅이다. 보드 Undo/Redo에는 이 구현에서 새 키 조합을 추가하지 않았다.

검증: `packages/ui/tests/useBoardShortcuts.test.ts`, `apps/free/tests/e2e/board-shortcuts.spec.ts`.

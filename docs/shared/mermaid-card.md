# MermaidCard 상세설계

소스: `packages/ui/src/features/mermaid/MermaidCard.tsx`, `useMermaidCard.ts`, `MermaidCodeEditor.tsx`, `useMermaidRenderer.ts`, `packages/core/src/mermaid-language.ts`

## 카드 구성

`mermaid`, `zoom`, `canEdit`, `isEditing`을 받아 `Rnd`와 편집·렌더 영역을 구성한다. 편집 진입·종료, 생성·수정·삭제, 레이어 변경은 부모 콜백으로 전달한다. 그룹 이동의 임시 표시에는 `groupOffset`을 사용한다.

| 영역 | 동작 |
| --- | --- |
| 카드 상단 다이어그램 선택 | `mermaidDiagramDefinitions`의 종류를 표시하고 선택한 종류의 템플릿으로 소스 교체 |
| CodeMirror 6 편집기 | 편집 중에만 표시. lazy/Suspense로 로드하고 소스 변경을 내부 초안에 반영 |
| 다이어그램 미리보기 | 현재 소스를 SVG로 렌더. 문법 오류 또는 빈 소스 상태를 별도로 표시 |
| 하단 드래그 핸들 | 편집 중 카드 이동 |
| Hand drawn look | Mermaid 설정을 소스에 반영하는 토글 |
| 툴바·삭제 확인 | 레이어 변경과 확인 후 삭제 |

`Rnd`의 최소 너비·높이는 180이다. 렌더 영역 외 카드 배경은 투명하다. 편집 중에는 활성 카드 레이어를 사용하고 비편집 상태에서는 저장된 `z`를 사용한다.

## 자동 완성

문법 후보 생성은 `mermaid-language.ts`의 공통 엔진이 담당한다. CodeMirror를 도입하는 것만으로 Mermaid 문법을 자동 지원하는 것이 아니다.

- 선택한 다이어그램 종류와 현재 입력 위치에 맞는 후보를 제공한다.
- Flowchart의 새 노드에는 도형 후보를, 연결 문맥에는 화살표와 대상 노드 후보를 제공한다.
- 이미 선언한 객체를 소스에서 수집하여 이후 객체 입력 위치에서 다시 제안한다.
- 후보 지원 범위는 엔진에 정의된 문맥을 따른다. Mermaid 전체 문법을 자동 검증·수정하는 기능과는 구분한다.

## 작업 완료

더블 클릭 또는 터치 더블 탭으로 편집한다. 본문은 `source`와 ref에 보관하고 빈 보드 클릭으로 편집이 끝날 때 확정한다. 신규 음수 ID 카드에는 `onInsert`, 기존 카드에는 `onUpdate`를 호출한다. 생성 시 `z`를 전달하고 기존 카드 수정은 현재 레이어를 별도로 유지한다.

이동·리사이즈 종료는 `onGeometryChange`로 반올림된 위치·크기만 부모 상태에 즉시 반영한다. 아직 확정하지 않은 소스까지 함께 저장하지 않는다. 내용 확정과 geometry 변경은 [공통 보드 이력](./board-history.md)의 기록 대상이다.

## 렌더러

Mermaid는 `startOnLoad: false`, `securityLevel: strict`로 초기화하며 ZenUML 등록 완료를 기다린 뒤 렌더한다. 반응형 SVG로 변환하고 임시 렌더 DOM 및 ZenUML 전역 스타일을 정리한다.

렌더 티켓으로 이전 비동기 결과가 최신 소스를 덮어쓰지 않도록 한다. SVG 결과와 오류는 현재 티켓의 결과만 반영한다. 문법 편집은 내부 상태에서 렌더되며 카드별 서버 CRUD를 호출하지 않는다.

Plus 미리보기는 카드 콜백의 `onPreviewUpdate`가 아니라 서버 저장 완료 버전을 기준으로 갱신한다. 삭제·레이어 변경·Undo/Redo도 같은 저장 경로를 사용한다.

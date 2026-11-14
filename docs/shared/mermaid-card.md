# MermaidCard 상세설계

소스: `packages/ui/src/features/mermaid/MermaidCard.tsx`, `useMermaidCard.ts`, `useMermaidDiagram.ts`, `MermaidEditorPanel.tsx`, `MermaidDiagramView.tsx`, `packages/ui/src/shared/useIsMobile.ts`

편집기·렌더러·도형 팔레트·문법 엔진은 [`@meldrift/diagram-engine`](https://github.com/Kim-kyuho/Meldrift-engine/tree/main/packages/diagram-engine)을 사용한다. Mermaid·CodeMirror는 엔진의 의존성으로만 설치되고 앱이 직접 가져오지 않는다.

## 엔진과 앱의 경계

| 소유자 | 책임 |
| --- | --- |
| Diagram Engine | Mermaid 12·ZenUML 렌더링, CodeMirror 6 편집기, 템플릿·문맥 자동완성·손그림 스타일, 팔레트·노드 조작·레이아웃 주석 |
| 공통 보드 UI | Free·Plus 공통 카드, 편집 패널의 위치·최소화, 엔진 인스턴스 연결·정리, SVG 뷰포트와 Rnd 크기 조정, 편집 완료 콜백 |
| 보드 데이터·앱 저장 계층 | 확정된 source·좌표·크기·레이어 저장, Undo/Redo와 Plus 동기화 |

앱은 엔진의 분할 화면(`createDiagram`) 대신 렌더러와 에디터를 따로 생성한다. 앱의 `useMermaidDiagram`은 React 상태·패널·카드 크기를 연결하는 어댑터이며 Mermaid 문법이나 노드 이동 엔진을 다시 구현하지 않는다. 이전 `MermaidCodeEditor`, `useMermaidRenderer`, `@meldrift/core/mermaid-language`는 사용하지 않는다.

## 다이어그램과 그림 조작

설치된 엔진은 34종의 템플릿과 종류 감지·선택을 제공한다. Flowchart, Swimlanes, Sequence, Class, State, Entity Relationship, User Journey, Gantt, Pie, Quadrant, Requirement, Git Graph, C4, Mindmap, Timeline, ZenUML, Sankey, XY Chart, Block, Packet, Kanban, Architecture, Radar, Event Modeling, Treemap, Venn, Ishikawa, Wardley, Cynefin, Tree View, Railroad, Railroad EBNF, Railroad ABNF, Railroad PEG다.

- 종류 선택은 해당 템플릿으로 소스를 교체한다. 문맥 자동완성과 이미 선언한 객체 제안은 엔진이 담당한다.
- 노드 드래그 대상은 연결선이 있는 Flowchart·Swimlanes·State·Class·ER·Requirement다. 위치만 바뀌면 노드·연결선을 갱신하며 전체 Mermaid를 다시 렌더하지 않는다.
- Flowchart·Swimlanes는 연결 핸들 드래그, 노드 이름·화살표 주석 편집, 화살표 종류 변경·삭제를 제공한다. 선택 후 Enter 또는 더블 클릭으로 글자를 편집하고 Esc로 선택·입력을 취소한다.
- Flowchart·Swimlanes의 노드 삭제는 연결선과 관련 style·class·click 줄 및 위치 주석도 함께 정리한다. 화살표만 지우면 양쪽 노드는 남는다.
- 일반 팔레트는 선택한 요소 하나를 커서 줄 또는 다음 줄에 삽입하고 중복되지 않는 ID를 발급한다. Flowchart·Swimlanes의 연결은 그림의 핸들로 만들고, 선택된 화살표의 팔레트는 종류 변경에 사용한다.

34종 전체가 노드 드래그·그림 편집을 지원한다는 의미는 아니다. 그림 조작이 없는 종류도 소스 편집·템플릿·팔레트를 사용한다.

## 카드 구성

`mermaid`, `zoom`, `canEdit`, `isEditing`을 받아 `Rnd`와 렌더 영역을 구성한다. 편집 진입·종료, 생성·수정·삭제, 레이어 변경은 부모 콜백으로 전달한다. 그룹 이동의 임시 표시에는 `groupOffset`을 사용한다.

에디터 위치는 화면 너비로 나눈다(`useIsMobile`, 768px 미만이 모바일).

| 화면 | 에디터 | 도형 팔레트 | 카드 |
| --- | --- | --- | --- |
| 데스크톱·태블릿 | 로고 아래 `MermaidEditorPanel`(메모 순서 패널 자리) | 패널의 에디터 아래 | 그림만 표시 |
| 모바일 | 화면 하단 고정 패널(최대 화면 높이의 45%, 오른쪽 툴바·하단 줌 영역·safe area 여백 확보) | 표시하지 않음 | 그림만 표시 |

모바일 패널은 `document.body` 포탈로 표시한다. 왼쪽 16px, 오른쪽 80px, 하단 `max(80px, safe-area-inset-bottom)`을 확보하며 카드의 자식이나 보드 변환 레이어 안에 넣지 않는다. 모바일에는 최소화 버튼을 표시하지 않는다.

| 영역 | 동작 |
| --- | --- |
| 엔진 에디터 툴바 | 다이어그램 종류 선택(템플릿으로 교체), 손그림 스타일 토글 |
| 엔진 에디터 | CodeMirror 6 기반, 문맥 자동완성. 소스 변경을 카드 초안에 반영 |
| 다이어그램 렌더러 | 현재 소스를 SVG로 렌더. 편집 중에는 노드 드래그와 그림에서 편집(Flowchart·Swimlanes) 가능 |
| 도형 팔레트 | 누르면 에디터 커서 위치에 요소 하나를 넣음. 화살표를 선택하면 화살표 종류로 바뀜 |
| 하단 드래그 핸들 | 편집 중 카드 이동 |
| 패널 닫기(X) | 초안을 저장하고 편집 종료 |
| 데스크톱 패널 최소화 | X 옆 버튼으로 제목 표시줄만 남김. 다시 누르면 에디터·팔레트를 펼치며 편집 내용과 엔진 인스턴스는 유지 |
| 툴바·삭제 확인 | 레이어 변경과 확인 후 삭제 |

`Rnd`의 최소 너비·높이는 180이다. 카드와 렌더러 배경은 투명하다. 편집 중에는 활성 카드 레이어를 사용하고 비편집 상태에서는 저장된 `z`를 사용한다.

데스크톱에서 다이어그램을 편집하는 동안에는 같은 자리를 쓰는 메모 순서 패널을 가리고, 편집이 끝나면 다시 보인다.

## 렌더러·에디터 연결

`useMermaidDiagram`이 카드의 렌더러와 에디터를 잇는다. 렌더러는 카드가 마운트될 때 한 번 만들고, 에디터는 편집 중에만 만든다. 에디터와 팔레트를 붙일 위치는 콜백 ref로 받아, 화면 크기가 바뀌어 위치가 달라지면 다시 붙인다.

- 에디터 입력 → 카드 `source` → 렌더러 `setSource`
- 커서 이동 → 렌더러 `setCursor`(팔레트 버튼 활성 판단)
- 팔레트 선택 → 에디터 `insertPaletteItem`
- 노드 이동·그림에서 편집 → 에디터 `setValue`(onChange 없음) + 카드 `source`. 렌더러가 이미 가진 소스는 다시 그리지 않는다.

패널 최소화는 에디터·팔레트를 숨길 뿐 언마운트하거나 편집을 확정하지 않는다. 화면이 모바일·데스크톱 경계를 넘어도 현재 초안과 렌더러·에디터를 유지하며 팔레트의 부착 여부만 바뀐다. 편집 종료는 에디터를 정리하고 팔레트를 떼며, 카드 언마운트는 렌더러·MutationObserver·예약된 animation frame도 정리한다.

팔레트는 엔진 렌더러가 만든 요소(`.meldrift-diagram-palette`)를 렌더러에서 떼어 패널에 옮겨 붙인다. 화살표 선택 시 화살표 종류로 바뀌는 엔진 동작을 그대로 쓰기 위해서다.

편집 중이 아닐 때 렌더 영역은 `inert`라서 그림을 건드리지 않고 카드 선택·더블 클릭 편집만 받는다. 편집이 끝나면 렌더러 캔버스에 Esc를 보내 그림에 남은 선택을 해제한다.

노드 위치는 엔진이 소스 끝에 `%% meldrift-layout: {...}` 주석으로 저장한다. Mermaid는 주석을 무시하므로 Markdown 내보내기에도 그대로 남는다.

## 카드 자동 맞춤과 노드 배율

엔진 소스는 변경하지 않고 앱의 `useMermaidDiagram`과 `mermaid-layout.ts`에서 SVG 뷰포트를 관리한다. 실제 SVG의 `getBBox()`로 노드·연결선·라벨의 영역을 측정하고 여백을 더해 카드 크기를 맞춘다. SVG의 논리 좌표나 노드 offset은 바꾸지 않는다.

- 소스 변경의 렌더 완료 또는 노드 이동 종료 때 확대·축소한다. 노드를 끄는 중에는 크기·배율을 바꾸지 않고 카드 밖 표시를 허용한다.
- 노드를 옮겼을 때 기존 노드 배율과 화면 위치를 유지하도록 카드 위치도 보정한다. 왼쪽·위쪽은 보드 원점에서 제한한다.
- 최소 크기는 기존처럼 180 × 180이다. 최소 크기 때문에 생기는 공간은 뷰포트 여백으로 남기며 노드를 찌그러뜨리지 않는다.
- Rnd 리사이즈는 컨테이너 크기만 바꾸고 SVG가 비율을 유지하며 확대·축소한다. 리사이즈 자체는 자동 맞춤 트리거가 아니므로 크기가 되돌아가는 루프가 없다.
- 신규 임시 카드는 첫 렌더에도 자동 맞춤한다. 저장된 카드의 첫 로드는 저장된 Rnd 크기를 유지하며, 보기만 했다는 이유로 geometry를 다시 저장하지 않는다.
- 노드 offset은 기존 엔진의 소스 주석으로 저장한다. Markdown 미리보기에도 실제 SVG 영역 맞춤을 적용해 밖으로 옮긴 노드가 잘리지 않게 한다.
- 모바일 에디터는 body 포탈의 고정 패널이므로 카드 크기·보드 줌·패닝과 독립적이다.

자동 맞춤은 엔진의 `onExpand`를 사용하지 않는다. 앱이 렌더 완료를 관찰하고 노드 이동 완료 콜백을 받아 양방향 크기 조정을 예약한다. `ResizeObserver`나 포인터 이동 프레임을 맞춤 트리거로 사용하지 않는다. 뷰포트 변경 뒤 엔진의 선택 테두리·조작 핸들도 새 좌표에 맞게 갱신한다.

## 작업 완료

더블 클릭 또는 터치 더블 탭으로 편집한다. 본문은 `source`와 ref에 보관하고 빈 보드 클릭이나 패널 닫기로 편집이 끝날 때 확정한다. 신규 음수 ID 카드에는 `onInsert`, 기존 카드에는 `onUpdate`를 호출한다. 생성 시 `z`를 전달하고 기존 카드 수정은 현재 레이어를 별도로 유지한다.

이동·리사이즈 종료는 `onGeometryChange`로 반올림된 위치·크기만 부모 상태에 즉시 반영한다. 아직 확정하지 않은 소스까지 함께 저장하지 않는다. 내용 확정과 geometry 변경은 [공통 보드 이력](./board-history.md)의 기록 대상이다.

## Markdown 미리보기

`MermaidDiagramView`가 엔진 렌더러를 읽기 전용(`palette`·`draggable`·`editable` 끔)으로 띄운다. 저장된 노드 위치는 읽기 전용에서도 적용된다.

Plus 미리보기는 카드 콜백의 `onPreviewUpdate`가 아니라 서버 저장 완료 버전을 기준으로 갱신한다. 삭제·레이어 변경·Undo/Redo도 같은 저장 경로를 사용한다.

## 검증

| 테스트 | 확인 사항 |
| --- | --- |
| `apps/free/tests/unit/MermaidCardEditor.test.tsx` | 에디터·팔레트 연결, 소스 입력·그림 조작 동기화, 최소화·복원·닫기, 모바일 전환, 편집 종료·언마운트 정리, 자동 확대·축소 |
| `packages/ui/tests/mermaid-layout.test.ts` | 최소 크기·배율·위치 보정, 잘못된 측정값, 이동한 노드를 포함하는 읽기 전용 뷰포트 |
| `packages/ui/tests/BoardMarkdownView.test.tsx` | 읽기 전용 옵션, source 갱신·중복 생성 방지, 미리보기 렌더러 정리 |
| `apps/free/tests/e2e/board-workspace.spec.ts` | 실제 엔진 입력·렌더, 데스크톱·태블릿 최소화, 모바일·320px 화면 툴바 비겹침, 노드 드래그 후 확대·축소와 핸들 정렬, Rnd 리사이즈·저장·재로드 |

단위 테스트는 앱과 엔진 사이의 연결을 모의 객체로 검사한다. 실제 Mermaid·CodeMirror와 브라우저의 SVG 크기·포인터 동작은 Chromium·모바일 WebKit·태블릿 WebKit E2E로 별도 검사한다. E2E 스크린샷은 OS 고정 경로가 아니라 Playwright의 테스트별 결과 경로를 사용한다.

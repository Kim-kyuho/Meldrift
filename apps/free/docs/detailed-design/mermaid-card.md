# MermaidCard 상세설계

소스: `components/MermaidCard.tsx`, `hooks/useMermaidCard.ts`, `hooks/useMermaidRenderer.ts`

카드 리사이즈 최소 크기는 정식 Meldrift와 동일하게 `180 x 180`이다.

## MermaidCard Props

| Prop | 타입 | 사용처 |
| --- | --- | --- |
| `mermaid` | `MermaidCardData` | `useMermaidCard`/`useMermaidRenderer`에 전달, `Rnd` 초기값 |
| `zoom` | `number` | `Rnd scale` |
| `isEditing` | `boolean` | textarea 노출(125줄), 드래그 핸들 노출(149줄), 툴바 노출(165줄), `Rnd disableDragging/enableResizing` |
| `onEditing`/`onEditingClear` | `() => void` | 편집 흐름 콜백 |
| `onInsert` | `(tempId, boardId, source, x, y, z, width, height) => void` | `saveMermaidDraft`가 `mermaid.id < 0`일 때 |
| `onUpdate` | 동일 시그니처 | 기존 카드일 때 |
| `onDelete` | `(id: number) => void` | `confirmDelete`에서 |
| `onBringToFront`/`onSendToBack` | `() => void` | `MermaidToolBar`로 전달 |

## `useMermaidCard` State (56~240줄)

| State/Ref | 초기값 | 갱신 지점 | 소비 지점 |
| --- | --- | --- | --- |
| `source` | `mermaid.source` | textarea `onChange={(e) => setSource(e.target.value)}` (MermaidCard.tsx 128줄) | `useMermaidRenderer`의 `source` 인자, `sourceRef` 동기화 |
| `cardState` | `{x,y,width,height} = mermaid.*` | `handleDragStop`, `handleResizeStop` | `Rnd position/size` |
| `dragHandlePressed` | `false` | 드래그 핸들 pointer 이벤트 4종 (MermaidCard.tsx 152~155줄) | 핸들 바 색상 |
| `deleteDialogOpen` | `false` | `openDeleteDialog`/`closeDeleteDialog`/`confirmDelete` | `ConfirmDialog` 렌더 조건 |
| `sourceRef`/`cardStateRef` | 각 state 미러 | `useEffect`로 렌더 후 동기화(72~78줄) | `insertMermaid`/`updateMermaid`가 최신값을 읽기 위함 |
| `lastMermaidTapRef` | `0` | `handleDoubleTap`마다 | 300ms 더블탭 판정 |
| `outsidePressStartedRef` | `false` | 전역 `pointerdown`/`pointerup` 리스너 (142~185줄) | `TableCard`와 동일한 "빈 보드에서 시작해 빈 보드에서 끝난 press"만 저장 트리거로 인정하는 판정 |

`TableCard`와의 차이: 이 훅의 판정 셀렉터 목록에는 `.confirm-dialog`가 없다(146, 160줄) — `TableCard`(`useTableCard`)는 `.confirm-dialog`를 제외 대상에 포함하지만, `MermaidCard`는 카드·툴바만 제외한다.

## 저장 (`saveMermaidDraft`, 80~117줄)

- `insertMermaid()`: `mermaid.id < 0`일 때 `onInsert(id, boardId, sourceRef.current, round(x), round(y), mermaid.z, round(width), round(height))`
- `updateMermaid()`: 그 외에는 동일 인자로 `onUpdate(...)`
- 두 함수 모두 `z`는 반올림하지 않고 원본 그대로 전달(x/y/width/height만 `Math.round`) — `ImageCard`와 동일한 패턴.

## 기타 핸들러

| 핸들러 | 동작 |
| --- | --- |
| `editMermaid()` | `onEditing()`을 호출해 바로 편집 시작 |
| `handleDoubleTap` | 터치 + 300ms 이내 재탭 → `editMermaid()` |
| `handleMermaidPress` | `stopPropagation()`만 |
| `handleDragStop`/`handleResizeStop` | `TableCard`/`ImageCard`와 동일 패턴으로 `cardState` 갱신 |
| `confirmDelete` (217~221줄) | `onDelete(id)` → `onEditingClear()` → `setDeleteDialogOpen(false)` (이 순서는 `TableCard`와 동일, `ImageCard`와는 뒤 두 호출 순서가 다름) |

## MermaidCard 렌더 구조 (88~182줄)

| 요소 | 조건 | 비고 |
| --- | --- | --- |
| `Rnd` (90줄) | 항상 | 최소 크기 `180 x 180`. `className="mermaid-rnd-{id} ..."`, `dragHandleClassName="mermaid-drag-handle"`, `disableDragging={!isEditing}`, `enableResizing={isEditing}` |
| Source textarea (126줄) | `isEditing`일 때만 | `h-2/5 min-h-24`, `font-mono`, `spellCheck={false}` — 카드 상단 40% |
| 렌더 결과 영역 (134줄) | 항상 | 3분기: `renderError` → rose `<pre>` / `svg` → `dangerouslySetInnerHTML` / 둘 다 없음 → "Mermaid source is empty." |
| 드래그 핸들 (150줄) | `isEditing`일 때만 | 하단 중앙, `TableCard`와 동일 시각 패턴 |
| `MermaidToolBar` (166줄) | `isEditing`일 때만 | `onDelete={openDeleteDialog}` |
| `ConfirmDialog` (174줄) | `deleteDialogOpen`일 때만 | 메시지 "Delete this mermaid?" |

## `useMermaidRenderer({ source, mermaidId })` (`hooks/useMermaidRenderer.ts`)

### 모듈 수준 초기화 (12~17줄)
- `mermaidRenderer.initialize({ startOnLoad: false, securityLevel: "strict" })` — 모든 인스턴스가 공유, 컴포넌트 마운트와 무관하게 앱 로드 시 1회
- `zenuml` 플러그인을 `registerExternalDiagrams`로 등록, 그 Promise를 `mermaidReady`로 보관해 렌더 전 항상 `await`

### State
| State | 초기값 | 갱신 지점 |
| --- | --- | --- |
| `svg` | `""` | 렌더 성공 시 정제된 SVG 문자열 |
| `renderError` | `""` | parse/render 실패 시 에러 메시지 |
| `renderTicketRef` | `0` | effect 실행마다 증가 — **경쟁 상태(race condition) 방지용 티켓** |

### 렌더 effect (59~97줄, deps `[mermaidId, source]`)
1. `renderTicket = renderTicketRef.current + 1` 후 즉시 반영(다음 렌더가 시작되면 이전 티켓은 즉시 무효화됨)
2. `source`가 공백뿐이면 마이크로태스크에서 `svg`/`renderError`를 빈 문자열로 초기화(티켓이 최신일 때만)
3. `renderId = "meldrift-mermaid-{|mermaidId|}-{전역 카운터}"` — 전역 `mermaidRenderIndex`를 매 렌더마다 증가시켜 **DOM id 충돌 방지**
4. `renderMermaidSvg` 성공/실패 각각에서 **`renderTicketRef.current !== renderTicket`이면 결과를 버림** — 빠르게 타이핑할 때 이전 렌더 결과가 최신 소스를 덮어쓰는 것을 방지
5. `finally`에서 `removeMermaidRenderArtifacts(renderId)` — Mermaid가 렌더 중 생성한 임시 DOM(`#renderId`, `#d{renderId}`)을 제거

### `renderMermaidSvg` (36~47줄)
1. `mermaidReady` 대기(zenUml 등록 완료 보장)
2. `mermaidRenderer.parse(source)`로 문법 검증(실패 시 예외)
3. `render(renderId, source)` → SVG 문자열
4. `makeMermaidSvgResponsive`로 고정 `width`/`height` 속성 제거 + `preserveAspectRatio="xMidYMid meet"` 삽입(카드 크기에 맞춰 반응형으로 표시되게 함)
5. `finally`에서 `removeZenUmlGlobalStyles()` 호출 — ZenUML이 주입하는 전역 `<style>` 중 `.zenuml .sequence-diagram`과 `--tw-ring-shadow`를 동시에 포함한 것을 찾아 제거(Tailwind ring 유틸리티와의 전역 스타일 충돌 방지)

## 알려진 특이사항

- `TableCard`/`useTableCard`는 외부 클릭 판정에서 `.confirm-dialog`를 제외하지만 `MermaidCard`/`useMermaidCard`는 제외하지 않는다 — 삭제 확인 다이얼로그가 열린 상태에서 그 배경을 클릭하면(다이얼로그 자체는 안 닫히지만) 이 컴포넌트에서는 board 바깥 클릭으로 오인되어 저장이 트리거될 가능성이 있다(다이얼로그가 board-scroll-layer 밖 포탈에 렌더되므로 실제 영향은 제한적일 수 있음 — 정확한 판정은 DOM 트리 구조에 따라 달라짐).
- Mermaid 렌더러의 "티켓" 패턴은 이 프로젝트에서 비동기 경쟁 상태를 다루는 유일한 명시적 사례로, `useBoardMarkdown`의 `AbortController` 패턴과 목적은 같지만 구현 방식이 다르다(취소가 아니라 사후 결과 폐기).

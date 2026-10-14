# Meldrift v1.3 Beta 문서

Meldrift는 같은 보드 기능을 두 Edition으로 배포한다. 두 Edition이 공유하는 것과 각자 다른 것을 폴더로 갈라 둔다.

| 폴더 | 서술 대상 | 소스 위치 |
| --- | --- | --- |
| `shared/` | 두 Edition이 함께 쓰는 컴포넌트와 훅 | `packages/**` |
| `plus/` | Plus Edition 고유 화면과 서버 기능 | `apps/plus/**` |
| `free/` | Free Edition 고유 저장 구조와 화면 | `apps/free/**` |

## 소스 경로 표기

Meldrift는 npm workspace 모노레포라 문서에서 경로를 두 가지 형태로 쓴다.

- **앱이 소유한 코드**는 그 앱 기준 상대경로로 쓴다. `plus/` 문서의 `components/BoardClient.tsx`는 `apps/plus/components/BoardClient.tsx`를, `free/` 문서의 같은 표기는 `apps/free/components/BoardClient.tsx`를 가리킨다.
- **공유 코드**는 저장소 루트 기준 전체 경로로 쓴다. 예: `packages/ui/src/features/memo/MemoCard.tsx`

공유 패키지는 넷이다.

| 패키지 | 담는 것 |
| --- | --- |
| `@meldrift/core` | 프레임워크에 기대지 않는 규칙과 스키마 — 카드 타입, 메모 순서, 획 데이터, 표 소스, AI 보드 계획 |
| `@meldrift/ui` | 두 Edition이 함께 쓰는 React 컴포넌트와 훅 |
| `@meldrift/board-data` | 보드 데이터 — 브라우저 SQLite·IndexedDB, 스냅샷 타입과 검증, 변경분 모델, 이미지 변환, Markdown 컴파일 |
| `@meldrift/ai` | 어시스턴트 본체 — 도구 정의, Gemini 호출, 프롬프트 뼈대 |

`@meldrift/ui`는 보드 화면과 React 훅을 조립하고, `@meldrift/board-data`는 데이터·저장·변환을 제공한다. 의존 방향은 `ui → board-data → core`다.

두 Edition의 앱(`apps/free`, `apps/plus`)에 남은 것은 **껍데기와 저장 방식**뿐이다. 보드 화면은 양쪽이 같은 `BoardClient`를 쓴다.

## 두 Edition이 갈리는 지점

| 영역 | Plus | Free |
| --- | --- | --- |
| 저장소 | 공통 SQLite·IndexedDB → Neon PostgreSQL | 공통 SQLite·IndexedDB |
| 로컬 저장 단위 | 보드 전체, 추가 변경이 없는 150ms 후 | 같다 |
| 서버 저장 단위 | `delta` 보드의 변경 필드·획·새 자산 청크, 로컬 저장 성공 후 3초 | 서버 저장 없음 |
| 보드 수 | 여러 개, 관리자 목록 관리 | 하나(`boardId = 1`) 고정 |
| 인증 | 세션 쿠키 로그인, 권한 플래그 | 없음. 카드 편집 권한 개념도 없다 |
| 이미지 | 로컬 BLOB + 서버의 불변 자산·바이너리 청크 | 로컬 BLOB |
| 반출입 | Markdown·이미지 ZIP + SQLite Export·Import·Reset. 파일 조작은 인증·권한 검사 | 같은 파일 기능, 인증 없음 |
| AI 잠금 | 승인된 로그인 사용자 + AI 비밀번호·서명 쿠키 | AI 비밀번호·서명 쿠키 |
| 보드 미리보기 | 있음(WebP를 Cloudinary에 업로드) | 없음 |
| 동시 접근 | 단일 활성 로그인 세션, 서버 revision 충돌 검사. 별도 탭 리스 없음 | 원격 동기화 없음 |

Plus의 현재 저장 경로는 [변경분 동기화](./plus/change-sync.md)다. `snapshot` 모드 보드는 [기존 전체 파일 업로드](./plus/board-snapshot.md)를 유지하며, 전환한 `delta` 보드에는 그 경로로 다시 쓰지 않는다. 구 카드별 쓰기 API는 차단되어 있고 신규 이미지 카드는 Cloudinary에 올리지 않는다.

## 공통 추가 사양

- [Undo/Redo](./shared/board-history.md): 하단 중앙 버튼, 최근 50개 객체 작업, 드로잉·Import·Reset 복원. 새로고침 시 초기화.
- [보드 단축키](./shared/board-shortcuts.md): 모드 토글 `1`·`2`, 카드 생성 `m`·`i`·`t`·`d`, 입력·편집·모달 보호.
- [다중 선택](./shared/board-selection.md): 카드 그룹 이동·삭제와 한 번의 이력 기록.
- [Mermaid 편집](./shared/mermaid-card.md): 종류 선택, CodeMirror 6 문맥 자동완성, 손그림 스타일.
- [표 크기](./shared/table-card.md): 가용 영역 채우기와 전체 행 수에 따른 최소 높이.
- [이미지](./shared/image-card.md): 드롭·투명도 보존·바이너리 복원.

## 어디서부터 읽나

| 알고 싶은 것 | 문서 |
| --- | --- |
| 보드 화면이 어떻게 조립되나 | [shared/board-client.md](./shared/board-client.md) |
| 이전 스냅샷 보드는 어떻게 저장하나 | [plus/board-snapshot.md](./plus/board-snapshot.md) |
| Plus가 변경분만 어떻게 올리나 | [plus/change-sync.md](./plus/change-sync.md) |
| 브라우저 SQLite가 어떻게 도나 | [shared/browser-database.md](./shared/browser-database.md) |
| 보드 값의 형태와 검증 | [shared/board-state.md](./shared/board-state.md) |
| 전체 아키텍처와 기능 | [meldrift-basic-design.md](./meldrift-basic-design.md) |
| 과거 상태를 어떻게 복원하나 | [shared/board-history.md](./shared/board-history.md) |

## 그 밖의 문서

- `meldrift-basic-design.md`: 전체 동작과 아키텍처
- `snippets/`: 구현 패턴
- `DB/`: Plus 데이터베이스 스키마 참조
- `playwright-testing.md`: e2e 테스트 규약

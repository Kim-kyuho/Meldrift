# Meldrift 문서

Meldrift는 같은 보드 기능을 두 Edition으로 배포한다. 두 Edition이 공유하는 것과 각자 다른 것을 폴더로 갈라 둔다.

| 폴더 | 서술 대상 | 소스 위치 |
| --- | --- | --- |
| `shared/` | 두 Edition이 함께 쓰는 컴포넌트와 훅 | `packages/**` |
| `plus/` | Plus Edition 고유 화면과 서버 기능 | `apps/plus/**` |
| `free/` | Free Edition 고유 저장 구조와 화면 | `apps/free/**` |

## 소스 경로 표기

Meldrift는 npm workspace 모노레포라 문서에서 경로를 두 가지 형태로 쓴다.

- **앱이 소유한 코드**는 그 앱 기준 상대경로로 쓴다. `plus/` 문서의 `components/BoardClient.tsx`는 `apps/plus/components/BoardClient.tsx`를, `free/` 문서의 같은 표기는 `apps/free/components/BoardClient.tsx`를 가리킨다.
- **공유 코드**는 저장소 루트 기준 전체 경로로 쓴다. 예: `packages/ui/src/components/MemoCard.tsx`

공유 패키지는 셋이다.

| 패키지 | 담는 것 |
| --- | --- |
| `@meldrift/core` | 프레임워크에 기대지 않는 규칙과 스키마 — 카드 타입, 메모 순서, 획 데이터, 표 소스, AI 보드 계획 |
| `@meldrift/ui` | 두 Edition이 함께 쓰는 React 컴포넌트와 훅 |
| `@meldrift/ai` | 어시스턴트 본체 — 도구 정의, Gemini 호출, 프롬프트 뼈대 |

## 두 Edition이 갈리는 지점

| 영역 | Plus | Free |
| --- | --- | --- |
| 저장소 | Neon PostgreSQL + Drizzle, Route Handler 경유 | 브라우저 SQLite WASM, 워커에서 IndexedDB 스냅샷 |
| 보드 수 | 여러 개, 소유자별 | 하나(`boardId = 1`) 고정 |
| 인증 | 세션 쿠키 로그인, 권한 플래그 | 없음. 카드 편집 권한 개념도 없다 |
| 이미지 | Cloudinary 업로드, `secure_url` 참조 | 브라우저에서 압축해 BLOB으로 DB에 저장 |
| 반출 | Markdown 문서 | Markdown 문서 + `.sqlite` 세이브 파일 |
| AI 잠금 | 로그인 사용자 권한 | 서명 토큰 쿠키 + 비밀번호 |
| 보드 미리보기 | 있음(WebP를 Cloudinary에 업로드) | 없음 |

## 그 밖의 문서

- `meldrift-basic-design.md`: 전체 동작과 아키텍처
- `snippets/`: 구현 패턴
- `DB/`: Plus 데이터베이스 스키마 참조
- `playwright-testing.md`: e2e 테스트 규약

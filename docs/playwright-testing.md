# Meldrift 테스트 실행 가이드

## 범위

Vitest는 공통 상태·변경분·저장 예약·이력·권한·카드 훅을 검증한다. Playwright는 실제 브라우저의 카드 조작, SQLite worker, IndexedDB, 파일 반출입, Undo/Redo와 화면 흐름을 검증한다.

| 영역 | 주요 검증 |
| --- | --- |
| 공통 보드 | 카드 생성·편집, 검색·정렬, 그룹 선택, 줌·핀치, Markdown |
| 단축키 | 모드 전환·카드 생성, 편집·모달·조합 입력 중 오동작 방지 |
| Undo/Redo | 카드와 획, 지우개, 이미지 삭제 복원, 일괄 이동, Import·Reset, Redo 제거 |
| Free 저장 | IndexedDB 저장과 새로고침 복원, SQLite Export/Import |
| Plus 저장 | 로컬 저장 후 서버 디바운스, 변경 필드·자산 청크, revision, 복원·재시도 |
| 인증 화면 | 로그인·가입 모달, 읽기 권한과 편집 권한의 구분 |

Plus의 `board-snapshot.spec.ts`와 `board-delta.spec.ts`는 보드 메타데이터를 읽되 브라우저 API를 가짜 서버로 가로채 저장 응답을 검증한다. 실제 Neon 바이너리 전송·트랜잭션·배포 제한 검증을 대신하지 않는다. snapshot 테스트는 이전 저장 경로, delta 테스트는 변경분 저장 경로를 검증한다.

## 실행

저장소 루트에서 실행한다.

```bash
npm run typecheck
npm test
npx playwright install --with-deps chromium webkit
npm run test:e2e:free
npm run test:e2e:plus
```

특정 조합만 실행하려면 workspace를 지정한다.

```bash
npm exec --workspace=meldrift-free -- playwright test tests/e2e/board-history.spec.ts --project=desktop-chromium
npm exec --workspace=meldrift-plus -- playwright test tests/e2e/board-delta.spec.ts --project=desktop-chromium
npm exec --workspace=meldrift-free -- playwright test --project=tablet-safari --headed --workers=1
```

기본 프로젝트는 `desktop-chromium`, `mobile-safari`, `tablet-safari`다. 모바일 프로젝트는 Playwright WebKit 환경이며 실제 iOS 기기 자체는 아니다.

## 서버와 데이터

Free는 기본 3100 포트를 사용한다. Plus는 3101의 Plus 서버와 3102의 Free 프록시를 통해 `/plus` 멀티존 경로를 검증한다. 이미 실행 중인 서버를 로컬에서는 재사용할 수 있다.

```bash
PLAYWRIGHT_BASE_URL=https://your-test-domain.example npm run test:e2e:plus
E2E_BOARD_ID=13 npm run test:e2e:plus
```

외부 URL을 지정하면 로컬 서버를 새로 실행하지 않는다. Plus에는 Neon 연결과 테스트용 보드 메타데이터가 필요하다. `E2E_BOARD_ID`가 없으면 첫 보드를 사용한다. 보드가 없을 때 일부 읽기 spec은 로컬에서 skip하지만 저장 흐름 spec은 fixture를 요구한다.

## 실패 자료

각 앱의 `test-results/`와 `playwright-report/`에 실패 화면·영상·trace를 남긴다.

```bash
npm exec --workspace=meldrift-free -- playwright show-report
npm exec --workspace=meldrift-plus -- playwright show-trace test-results/<test-directory>/trace.zip
```

도구 업데이트 후 브라우저 시작 자체가 실패하면 현재 lockfile과 일치하는 Playwright 및 브라우저를 설치했는지 먼저 확인한다. 테스트 목록 수집이나 에뮬레이션만으로 실제 Safari 검증이 완료됐다고 보지 않는다. Apple Pencil·팜 리젝션·iOS 스크롤은 실제 iPad에서도 확인한다.

## GitHub Actions

`.github/workflows/tests.yml`은 `main` 대상 Pull Request와 수동 실행에서 동작하며 push 트리거는 없다.

```text
npm ci → lint → typecheck → unit tests → Free/Plus build
→ Chromium/WebKit 설치 → Free E2E → Plus E2E
```

- `NEON_CONNECTION_STRING`이 있을 때만 Plus E2E를 실행한다. 없으면 이유를 남기고 건너뛴다.
- `E2E_BOARD_ID`는 선택 secret이다.
- Dependabot 등 secret을 받지 못하는 실행의 Plus skip은 Plus 테스트 통과와 구분한다.
- 취소되지 않은 실행은 각 앱의 HTML 보고서를 30일 artifact로 보관한다.
- 같은 PR의 새 실행은 이전 실행을 취소한다.

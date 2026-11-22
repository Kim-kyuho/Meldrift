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

Plus의 `board-snapshot.spec.ts`와 `board-delta.spec.ts`는 실제 소유자 세션으로 보드 페이지를 열고 브라우저의 저장 API를 모킹한다. snapshot 테스트는 이전 저장 경로, delta 테스트는 변경분 저장 경로를 검증한다. Neon에 배포된 환경의 바이너리 전송과 제한은 별도로 확인해야 한다.

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

Free는 기본 3100 포트를 사용한다. Plus는 3101의 Plus 서버와 3102의 Free 프록시를 통해 `/plus` 멀티존 경로를 검증한다. Plus의 로컬 실행은 3103에서 격리된 PostgreSQL을 시작하고 마이그레이션과 테스트 데이터를 적용한다.

```bash
PLAYWRIGHT_BASE_URL=https://your-test-domain.example npm run test:e2e:plus
```

외부 테스트 서버로 저장 테스트를 실행할 때는 `E2E_OWNER_EMAIL`과 `E2E_OWNER_PASSWORD`에 테스트용 작성 가능 계정을 지정한다. `E2E_BOARD_ID`를 지정하면 해당 보드를 사용하므로 계정에 편집 권한이 있어야 한다. 비로그인 화면 테스트에서도 해당 보드를 여는 경우 공개 테스트 보드를 지정한다.

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

- Plus E2E는 매번 격리된 PostgreSQL을 사용하므로 Neon 연결이나 테스트 계정 secret 없이 실행된다.
- 취소되지 않은 실행은 각 앱의 HTML 보고서를 30일 artifact로 보관한다.
- 같은 PR의 새 실행은 이전 실행을 취소한다.

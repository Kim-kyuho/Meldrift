# Meldrift Playwright 실행 가이드

## 테스트 범위

읽기 흐름이 대부분이고, 보드 스냅샷만 실제로 데이터를 쓴다.

- 보드 목록과 공통 메뉴
- 로그인/가입 모달
- 보드 레이어 렌더링
- 줌 컨트롤
- 메모 검색 패널
- Markdown 컴파일 모달
- 메모 순서 변경
- Desktop Chromium, iPhone Safari, iPad Safari

`apps/plus/tests/e2e/board-snapshot.spec.ts`는 예외다. 실제로 카드를 만들고 저장 흐름 전체를 지나간다.

| spec | 검증하는 것 |
| --- | --- |
| 로컬 저장 → 업로드 → 새로고침 | 3초 디바운스 뒤 SQLite가 올라가고, 새로고침해도 메모와 이미지가 남는다 |
| 미동기화 편집 → 두 번째 탭 | 올라가지 않은 편집이 새로고침을 넘어 남고, 두 번째 탭의 편집은 막힌다 |

`E2E_BOARD_ID`가 가리키는 보드를 실제로 수정하므로, 공용 보드를 가리키지 않게 한다.

## 최초 설치

```bash
npm run test:e2e:install
```

Docker에서 실행할 경우 Playwright 브라우저와 OS 의존성이 이미지에 설치되어 있어야 한다.

## 기본 실행

```bash
# 전체 프로젝트와 전체 spec
npm run test:e2e

# 특정 브라우저 프로젝트
npx playwright test --project=desktop-chromium
npx playwright test --project=mobile-safari
npx playwright test --project=tablet-safari

# 특정 파일
npx playwright test tests/e2e/board-workspace.spec.ts

# 테스트 이름으로 필터
npx playwright test -g "줌 버튼"
```

## 화면을 보면서 실행

```bash
# 실제 브라우저 창 표시
npm run test:e2e:headed

# Playwright UI에서 테스트 선택·재실행
npm run test:e2e:ui

# Inspector를 열고 한 단계씩 실행
npm run test:e2e:debug
```

## 실패 결과 확인

```bash
npm run test:e2e:report
```

실패한 테스트는 다음 자료를 `test-results/`과 `playwright-report/`에 남긴다.

- 실패 화면 screenshot
- 실패 시점까지의 video
- DOM snapshot, network, action을 포함한 trace

Trace만 직접 열려면 다음 명령을 사용한다.

```bash
npx playwright show-trace test-results/<test-directory>/trace.zip
```

## 외부 환경 실행

```bash
PLAYWRIGHT_BASE_URL=https://meldrift.vercel.app npm run test:e2e
```

`PLAYWRIGHT_BASE_URL`이 있으면 Playwright는 로컬 Next 서버를 실행하지 않는다.

## 테스트 보드 고정

```bash
E2E_BOARD_ID=13 npm run test:e2e
```

`E2E_BOARD_ID`가 없으면 보드 목록의 첫 번째 보드를 사용한다. 로컬에서 목록에 보드가 하나도 없으면 보드 작업 화면 spec만 skip한다. CI에서는 테스트가 조용히 통과하지 않도록 명시적으로 실패시킨다.

## GitHub Actions

`.github/workflows/tests.yml`은 `main` 대상 Pull Request 또는 수동 실행에서 동작한다. 기능 브랜치 push와 Pull Request가 같은 검사를 중복 실행하지 않도록 push 트리거는 사용하지 않는다.

```text
npm ci
→ npm run lint
→ npx tsc --noEmit
→ npm test
→ npm run build
→ Playwright Chromium/WebKit 설치
→ npm run test:e2e
```

- 필수 secret: `NEON_CONNECTION_STRING`
- 선택 secret: `E2E_BOARD_ID` (없으면 첫 보드 사용)
- 실패 여부와 관계없이 `playwright-report/`를 30일 artifact로 업로드한다.
- 같은 PR에 새 커밋이 들어오면 이전 실행은 `concurrency` 설정으로 취소한다.

## 디버깅용 단일 조합

```bash
npx playwright test tests/e2e/board-workspace.spec.ts \
  --project=tablet-safari \
  --headed \
  --workers=1
```

모바일 포인터 문제는 실제 iOS Safari와 WebKit 에뮬레이션 결과가 완전히 같지 않을 수 있다. Playwright는 회귀 검증에 사용하고 Apple Pencil·팜 리젝션은 실제 iPad에서도 최종 확인한다.

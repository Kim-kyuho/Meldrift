# Meldrift Playwright 실행 가이드

## 테스트 범위

현재 E2E 테스트는 단일 보드 진입, 브라우저 SQLite 초기화와 Export를 포함한 화면 흐름을 검증한다.

- 단일 보드와 공통 메뉴
- 인증 UI가 없는지 확인
- 보드 레이어 렌더링
- 줌 컨트롤
- 메모 검색 패널
- Markdown 컴파일 모달
- Desktop Chromium, iPhone Safari, iPad Safari

각 Playwright browser context는 자신의 origin별 IndexedDB를 사용한다.

## 최초 설치

```bash
npm run test:e2e:install
```

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
PLAYWRIGHT_BASE_URL=https://your-deployment.example npm run test:e2e
```

`PLAYWRIGHT_BASE_URL`이 있으면 Playwright는 로컬 Next 서버를 실행하지 않는다.

## 디버깅용 단일 조합

```bash
npx playwright test tests/e2e/board-workspace.spec.ts \
  --project=tablet-safari \
  --headed \
  --workers=1
```

모바일 포인터 문제는 실제 iOS Safari와 WebKit 에뮬레이션 결과가 완전히 같지 않을 수 있다. Playwright는 회귀 검증에 사용하고 Apple Pencil·팜 리젝션은 실제 iPad에서도 최종 확인한다.

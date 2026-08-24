import { defineConfig, devices } from "@playwright/test";

// PLAYWRIGHT_BASE_URL을 지정하면 로컬 서버를 새로 띄우지 않고 해당 환경을 검사한다.
// 예: PLAYWRIGHT_BASE_URL=https://kyu-board.vercel.app npm run test:e2e
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3101";
const usesExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
    // Vitest 파일과 Playwright 파일을 분리해 각 도구가 자신의 테스트만 검색하게 한다.
    testDir: "./tests/e2e",
    testMatch: "**/*.spec.ts",

    // 테스트 파일 간에는 병렬 실행한다. 같은 파일 안의 테스트는 기본적으로 선언 순서대로 실행한다.
    fullyParallel: true,

    // 실수로 test.only가 커밋되면 CI를 실패시킨다.
    forbidOnly: Boolean(process.env.CI),

    // 로컬에서는 실패를 즉시 확인하고, CI에서는 일시적인 브라우저 실패를 한 번 재검증한다.
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,

    // list는 터미널 진행 상황, html은 실패 단계와 첨부 파일을 확인하는 보고서다.
    reporter: [
        ["list"],
        ["html", { open: "never" }],
    ],

    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },

    use: {
        baseURL,

        // 실패한 테스트만 화면·동영상·trace를 남겨 결과 폴더가 불필요하게 커지는 것을 막는다.
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        trace: "retain-on-failure",

        actionTimeout: 10_000,
        navigationTimeout: 30_000,
    },

    // Meldrift에서 실제로 중요한 데스크톱과 Apple 모바일 화면을 우선 검증한다.
    projects: [
        {
            name: "desktop-chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "mobile-safari",
            use: { ...devices["iPhone 15"] },
        },
        {
            name: "tablet-safari",
            use: { ...devices["iPad Pro 11"] },
        },
    ],

    // 외부 URL이 없을 때만 Next 개발 서버를 실행한다.
    // 이미 3000 포트 서버가 있다면 로컬에서는 해당 서버를 재사용한다.
    webServer: usesExternalServer
        ? undefined
        : {
            command: "npm run dev -- --hostname 0.0.0.0 --port 3101",
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: {
                PLUS_STANDALONE: "true",
            },
        },
});

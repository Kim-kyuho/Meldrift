import { defineConfig, devices } from "@playwright/test";

// Live 협업 e2e. 기본 e2e는 /api/**를 가로채는 가짜 서버를 쓰므로, Live 연결이 섞이지 않게 설정을 나눈다.
// 실제 Next 라우트·고정 데이터베이스(PGlite)·개발용 Live 서버를 함께 띄워 두 사용자를 동시에 접속시킨다.
const fixtureDb = "postgresql://e2e:e2e@localhost/meldrift_e2e";
const livePort = 3104;

export default defineConfig({
    testDir: "./tests/e2e-live",
    testMatch: "**/*.spec.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    timeout: 90_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: "http://localhost:3102",
        actionTimeout: 10_000,
        navigationTimeout: 60_000,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: [{
        command: "node tests/e2e/fixture-db.mjs",
        url: "http://127.0.0.1:3103/ready",
        env: { FIXTURE_LIVE: "1" },
    }, {
        command: "npm run dev:live",
        url: `http://127.0.0.1:${livePort}/__live/health`,
        timeout: 60_000,
        env: { NEON_CONNECTION_STRING: fixtureDb, LIVE_DEV_PORT: String(livePort), LIVE_MAX_DURATION_SECONDS: "300" },
    }, {
        command: "npm run dev -- --hostname 0.0.0.0 --port 3101",
        url: "http://localhost:3101/plus",
        timeout: 120_000,
        env: {
            PLUS_STANDALONE: "false",
            NEON_CONNECTION_STRING: fixtureDb,
            CLOUDINARY_CLOUD_NAME: "",
            CLOUDINARY_API_KEY: "",
            CLOUDINARY_API_SECRET: "",
            LIVE_ENABLED: "true",
            LIVE_DEV_BRIDGE_URL: `http://127.0.0.1:${livePort}/__live/bridge`,
            NEXT_PUBLIC_LIVE_URL: `ws://localhost:${livePort}`,
        },
    }, {
        command: "npm run dev --workspace=meldrift-free -- --hostname 0.0.0.0 --port 3102",
        url: "http://localhost:3102/plus",
        timeout: 120_000,
        env: { PLUS_ORIGIN: "http://localhost:3101" },
    }],
});

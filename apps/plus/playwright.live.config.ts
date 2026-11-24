import { defineConfig, devices } from "@playwright/test";

// Live 협업 e2e. 기본 e2e는 /api/**를 가로채는 가짜 서버를 쓰므로, Live 연결이 섞이지 않게 설정을 나눈다.
// 실제 Next 라우트·고정 데이터베이스(PGlite)에서 여러 브라우저의 직접 연결을 검증한다.
const fixtureDb = "postgresql://e2e:e2e@localhost/meldrift_e2e";
const liveFixtureEnv = {
    NEON_CONNECTION_STRING: fixtureDb,
    REDIS_URL: "",
    LIVE_TOKEN_SECRET: "meldrift-local-test-secret",
};

export default defineConfig({
    testDir: "./tests/e2e-live",
    testMatch: "**/*.spec.ts",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    workers: 1,
    retries: 0,
    reporter: [["list"]],
    outputDir: "test-results/live",
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
        command: "npm run dev -- --hostname 0.0.0.0 --port 3101",
        url: "http://localhost:3101/plus",
        timeout: 120_000,
        env: {
            ...liveFixtureEnv,
            PLUS_STANDALONE: "false",
            CLOUDINARY_CLOUD_NAME: "",
            CLOUDINARY_API_KEY: "",
            CLOUDINARY_API_SECRET: "",
            LIVE_ENABLED: "true",
            NEXT_PUBLIC_PEER_LIVE_STUN_URLS: "",
        },
    }, {
        command: "npm run dev --workspace=meldrift-free -- --hostname 0.0.0.0 --port 3102",
        url: "http://localhost:3102/plus",
        timeout: 120_000,
        env: { PLUS_ORIGIN: "http://localhost:3101" },
    }],
});

import { request, type BrowserContextOptions, type FullConfig } from "@playwright/test";

export default async function setupOwner(config: FullConfig) {
    const external = Boolean(process.env.PLAYWRIGHT_BASE_URL);
    const email = external ? process.env.E2E_OWNER_EMAIL : "owner@example.test";
    const password = external ? process.env.E2E_OWNER_PASSWORD : "Fixture-password-2026";
    if (!email || !password) {
        return;
    }
    if (!external) {
        process.env.E2E_BOARD_ID = "1";
    }

    const api = await request.newContext({ baseURL: config.projects[0].use.baseURL });
    try {
        const login = await api.post("/plus/api/signin", { data: { email, password } });
        if (!login.ok()) {throw new Error(`E2E owner sign-in failed (${login.status()}).`);}
        process.env.E2E_OWNER_SESSION = JSON.stringify(await api.storageState());
    } finally {
        await api.dispose();
    }
}

export function ownerSession(): BrowserContextOptions["storageState"] {
    const state = process.env.E2E_OWNER_SESSION;
    if (!state) {
        throw new Error("Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD for editing tests on an external test deployment.");
    }
    return JSON.parse(state) as BrowserContextOptions["storageState"];
}

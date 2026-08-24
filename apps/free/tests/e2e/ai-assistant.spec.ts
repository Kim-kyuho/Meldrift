import { expect, test } from "@playwright/test";
import { aiTestPassword, gotoHydratedPage } from "./helpers";

// 어시스턴트는 Free Edition의 유일한 서버 기능이고, 잠금이 곧 비용 통제다.
// 여기서 검사하는 것은 "비밀번호 없이는 못 들어간다"와 "한 번 풀면 다시 묻지 않는다"다.
// 실제 모델 호출은 하지 않는다. 더미 키로는 어차피 실패하고, 진짜 키를 CI에 두지 않는다.

test.describe("AI assistant lock", () => {
    test.beforeEach(async ({ page }) => {
        await gotoHydratedPage(page, "/");

        // 로컬에서 환경변수 없는 기존 3000 포트 서버를 재사용하면 어시스턴트가 꺼져 있다.
        // 그때만 건너뛴다. CI는 playwright.config.ts가 값을 넣어 주므로 반드시 실행된다.
        const status = await page.request.get("/api/ai/status");
        const { configured } = await status.json();
        test.skip(!configured && !process.env.CI, "The assistant is not configured on this server.");
    });

    const openAssistant = (page: import("@playwright/test").Page) =>
        page.getByRole("button", { name: "Open AI assistant" }).click();

    test("asks for the password before showing the chat", async ({ page }) => {
        await openAssistant(page);

        await expect(page.getByText("AI Assistant is locked")).toBeVisible();
        await expect(page.getByLabel("Assistant password")).toBeVisible();
        await expect(page.getByLabel("AI assistant message")).toHaveCount(0);
    });

    test("rejects a wrong password and keeps the chat closed", async ({ page }) => {
        await openAssistant(page);
        await page.getByLabel("Assistant password").fill("not-the-password");
        await page.getByRole("button", { name: "Unlock" }).click();

        // 세 브라우저 프로젝트가 같은 주소에서 들어오므로 실패 횟수 카운터를 공유한다.
        // 재시도까지 겹치면 잠금 안내로 바뀔 수 있어 어느 쪽이든 통과시킨다.
        // 정작 중요한 것은 아래 줄, 틀린 비밀번호로는 채팅이 열리지 않는다는 것이다.
        await expect(page.getByText(/not correct|Too many failed attempts/)).toBeVisible();
        await expect(page.getByLabel("AI assistant message")).toHaveCount(0);
    });

    test("opens the chat with the right password and stays unlocked after a reload", async ({ page }) => {
        await openAssistant(page);
        await page.getByLabel("Assistant password").fill(aiTestPassword);
        await page.getByRole("button", { name: "Unlock" }).click();

        await expect(page.getByLabel("AI assistant message")).toBeVisible();
        await expect(page.getByText("How can I help?")).toBeVisible();

        // 잠금 쿠키는 HttpOnly여야 한다. 스크립트가 읽을 수 있으면 유출 경로가 된다.
        expect(await page.evaluate(() => document.cookie)).not.toContain("meldrift_ai");

        // 새로고침해도 다시 묻지 않는다. 쿠키를 브라우저가 알아서 실어 보내기 때문이다.
        await gotoHydratedPage(page, "/");
        await openAssistant(page);
        await expect(page.getByLabel("AI assistant message")).toBeVisible();
    });

    test("locks again when the user asks for it", async ({ page }) => {
        await openAssistant(page);
        await page.getByLabel("Assistant password").fill(aiTestPassword);
        await page.getByRole("button", { name: "Unlock" }).click();
        await expect(page.getByLabel("AI assistant message")).toBeVisible();

        await page.getByRole("button", { name: "Lock AI assistant" }).click();
        await expect(page.getByLabel("AI assistant message")).toHaveCount(0);

        await openAssistant(page);
        await expect(page.getByLabel("Assistant password")).toBeVisible();
    });
});

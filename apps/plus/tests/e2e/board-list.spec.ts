import { expect, test } from "@playwright/test";
import { getBoardMenuButton, gotoHydratedPage } from "./helpers";

test.describe("보드 목록", () => {
    test.beforeEach(async ({ page }) => {
        // DOM 표시뿐 아니라 React event handler 연결까지 기다린다.
        await gotoHydratedPage(page, "/");
    });

    test("기본 목록 UI를 표시한다", async ({ page }) => {
        await expect(page).toHaveTitle(/Meldrift/i);
        await expect(page.getByRole("link", { name: "Meldrift home" })).toBeVisible();
        await expect(page.getByRole("button", { name: "New Board" })).toBeVisible();
    });

    test("로그인 모달을 열고 닫는다", async ({ page }) => {
        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Sign-in" }).click();

        await expect(page.getByRole("heading", { name: "Sign-in" })).toBeVisible();
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.getByLabel("Password")).toBeVisible();

        await page.getByRole("button", { name: "Close sign-in modal" }).click();
        await expect(page.getByRole("heading", { name: "Sign-in" })).toBeHidden();
    });

    test("가입 입력 오류를 클라이언트에서 표시한다", async ({ page }) => {
        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Sign-up", exact: true }).click();

        // 서버에 가입 요청이 가지 않도록 유효한 이메일과 의도적으로 잘못된 비밀번호를 사용한다.
        await page.getByLabel("Email").fill("playwright@example.com");
        await page.getByLabel("Password", { exact: true }).fill("short");
        await page.getByLabel("Confirm password").fill("different");
        await page.getByRole("button", { name: "Sign-up", exact: true }).click();

        await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
    });
});

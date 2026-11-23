import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { getBoardMenuButton, gotoHydratedPage } from "./helpers";

async function fixtureQuery(request: APIRequestContext, query: string, params: (string | number)[]) {
    const response = await request.post("http://127.0.0.1:3103/sql", { data: { query, params } });
    expect(response.ok(), "The local fixture query should succeed.").toBe(true);
    return response.json();
}

async function signInFixtureMember(page: Page, request: APIRequestContext, role: "user" | "admin") {
    const credentials = { email: `${role}-${randomUUID()}@example.test`, password: "Fixture-password-2026" };
    expect((await page.request.post("/plus/api/signup", { data: credentials })).status()).toBe(201);
    await fixtureQuery(request, "UPDATE users SET permission_flg = true, role = $2 WHERE email = $1", [credentials.email, role]);
    expect((await page.request.post("/plus/api/signin", { data: credentials })).status()).toBe(200);
    return credentials;
}

test.describe("보드 목록", () => {
    test.beforeEach(async ({ page }) => {
        // DOM 표시뿐 아니라 React event handler 연결까지 기다린다.
        await gotoHydratedPage(page, "/");
    });

    test("기본 목록 UI를 표시한다", async ({ page }) => {
        await expect(page).toHaveTitle(/Meldrift/i);
        const homeLink = page.getByRole("link", { name: "Meldrift home" });
        await expect(homeLink).toBeVisible();
        await expect(page).toHaveURL(/\/plus\/?$/);
        const logoImages = homeLink.locator("img");
        await expect(logoImages).toHaveCount(2);
        for (const image of await logoImages.all()) {
            await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0
            ), { message: "Meldrift logo must load successfully" }).toBe(true);
        }
        await expect(page.getByRole("combobox", { name: "Sort:", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "New Board" })).toHaveCount(0);
        await getBoardMenuButton(page).click();
        await expect(page.getByText("Board List", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "My Page" })).toHaveCount(0);
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

    test("관리자는 목록의 보드 생성 버튼을 사용하고 이메일로 회원을 찾는다", async ({ page, request }) => {
        test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), "Uses a disposable administrator in the local test database.");
        const { email } = await signInFixtureMember(page, request, "admin");
        await gotoHydratedPage(page, "/");
        await page.getByRole("button", { name: "New Board" }).click();
        await expect(page.getByRole("heading", { name: "Create board" })).toBeVisible();
        await page.getByRole("button", { name: "Close create board modal" }).click();

        await getBoardMenuButton(page).click();
        await expect(page.getByText("Board List", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Manage Members" }).click();
        const members = page.getByRole("dialog", { name: "Manage members" });
        await expect(members.getByRole("button", { name: `Edit ${email}` })).toBeVisible();
        const search = members.getByRole("searchbox", { name: "Search by email" });
        await search.fill("OWNER@");
        await expect(members.getByRole("button", { name: `Edit ${email}` })).toHaveCount(0);
        await members.getByRole("button", { name: "Edit owner@example.test" }).click();
        const edit = page.getByRole("dialog", { name: "Edit member" });
        await expect(edit.getByText("owner@example.test", { exact: true })).toBeVisible();
        await edit.getByRole("button", { name: "Cancel" }).click();
        await expect(search).toHaveValue("OWNER@");
    });

    test("My Page에서 탈퇴하면 계정은 삭제되고 작성한 보드는 보존된다", async ({ page, request }) => {
        test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), "Uses a disposable account in the local test database.");
        const credentials = await signInFixtureMember(page, request, "user");
        const boardTitle = "Withdrawal test board";
        const created = await page.request.post("/plus/api/boards", { data: {
            title: boardTitle, width: 800, height: 400, privateFlg: 0,
        } });
        expect(created.ok()).toBe(true);
        const { board: { boardId } } = await created.json();
        await gotoHydratedPage(page, `/boards/${boardId}`);
        const help = page.getByRole("dialog", { name: "Help" });
        await expect(help).toBeVisible();
        await expect(help.getByText("Meldrift+ Storage")).toBeVisible();
        await help.getByRole("button", { name: "Close Help" }).click();
        await page.getByRole("button", { name: "Close (Esc)" }).click();
        await gotoHydratedPage(page, `/boards/${boardId}`);
        await expect(page.locator(".board-scroll-layer")).toBeVisible({ timeout: 20000 });
        await expect(help).toHaveCount(0);

        await getBoardMenuButton(page).click();
        await expect(page.getByText(boardTitle, { exact: true })).toBeVisible();
        await expect(page.getByRole("separator")).toBeVisible();
        await expect(page.getByText("Board List", { exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "My Page" }).click();

        const profile = page.getByRole("dialog", { name: "My Page" });
        await expect(profile.getByLabel("Email")).toHaveValue(credentials.email);
        await expect(profile.getByLabel("Email")).toHaveAttribute("readonly", "");
        await expect(profile.getByRole("checkbox", { name: "Board authoring" })).toBeDisabled();
        await expect(profile.getByRole("checkbox", { name: "Board authoring" })).toBeChecked();
        await expect(profile.getByRole("combobox", { name: "Role" })).toHaveValue("user");
        await profile.getByRole("button", { name: "Delete account" }).click();

        const confirmation = page.getByRole("dialog", { name: "Delete your account?" });
        await confirmation.getByRole("button", { name: "Cancel" }).click();
        await expect(profile).toBeVisible();
        await profile.getByRole("button", { name: "Delete account" }).click();
        await Promise.all([
            page.waitForURL(/\/plus\/?$/, { waitUntil: "load" }),
            confirmation.getByRole("button", { name: "Permanently delete" }).click(),
        ]);
        await expect.poll(async () => (await (await page.request.get("/plus/api/me")).json()).user).toBeNull();
        expect((await page.request.post("/plus/api/signin", { data: credentials })).status()).toBe(401);
        const retained = await fixtureQuery(request, "SELECT owner_id, private_flg FROM boards WHERE board_id = $1", [boardId]);
        expect(retained.rows).toEqual([[credentials.email, "1"]]);
    });
});

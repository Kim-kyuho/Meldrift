import { expect, test, type Browser, type Page } from "@playwright/test";

const password = "Fixture-password-2026";

async function signedInPage(browser: Browser, email: string, boardId = 1, inspect?: (page: Page) => void) {
    const context = await browser.newContext();
    const login = await context.request.post("/plus/api/signin", { data: { email, password } });
    expect(login.ok(), `sign-in for ${email}`).toBe(true);
    const page = await context.newPage();
    inspect?.(page);
    await page.goto(`/plus/boards/${boardId}`);
    await expect(page.locator(".board-scroll-layer")).toBeVisible({ timeout: 60_000 });
    return page;
}

const presence = (page: Page) => page.getByRole("button", { name: /Live collaboration connected\. \d+ people/ });
const memo = (page: Page, text: string) => page.locator('[class*="memo-rnd-"]').filter({ hasText: text });
const memoX = (page: Page, text: string) => memo(page, text).evaluate((element: HTMLElement) =>
    Math.round(new DOMMatrixReadOnly(element.style.transform).m41));

async function finishEditing(page: Page) {
    const card = page.locator('[data-editing="true"]');
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, Math.max(5, box.y - 40));
    await expect(card).toHaveCount(0);
}

test("두 사용자가 접속자·잠금·변경을 실시간으로 주고받는다", async ({ browser }) => {
    const owner = await signedInPage(browser, "owner@example.test");
    const member = await signedInPage(browser, "member@example.test");

    // 접속자 표시: 서로의 이메일이 보인다.
    await expect(presence(owner)).toHaveAccessibleName(/2 people/);
    await expect(presence(member)).toHaveAccessibleName(/2 people/);
    await presence(member).click();
    await expect(member.getByText("owner@example.test")).toBeVisible();
    await presence(member).click();

    // 소유자가 메모를 편집하면 멤버 화면에 잠금이 보이고, 멤버는 편집할 수 없다.
    await memo(owner, "First memo").locator(".memo-editor-content").dblclick();
    await expect(owner.locator('[data-editing="true"]')).toHaveCount(1);
    const lock = member.locator('[data-live-lock="memo:memo-1"]');
    await expect(lock).toBeVisible();
    await expect(lock).toContainText("owner · editing");

    await lock.click({ force: true });
    await expect(member.getByText(/owner@example\.test is editing this/)).toBeVisible();
    await expect(member.locator('[data-editing="true"]')).toHaveCount(0);

    // 소유자가 메모를 옮기고 편집을 끝내면, 멤버 화면에 새 위치가 반영되고 잠금이 풀린다.
    const before = await memoX(member, "First memo");
    const handle = (await memo(owner, "First memo").locator(".memo-drag-handle").boundingBox())!;
    await owner.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await owner.mouse.down();
    await owner.mouse.move(handle.x + handle.width / 2 + 80, handle.y + handle.height / 2 + 30, { steps: 8 });
    await owner.mouse.up();
    await finishEditing(owner);

    await expect.poll(() => memoX(member, "First memo"), { timeout: 15_000 }).toBeGreaterThan(before + 40);
    await expect(lock).toHaveCount(0, { timeout: 15_000 });

    // 잠금이 풀린 뒤에는 멤버가 같은 메모를 편집할 수 있다.
    await memo(member, "First memo").locator(".memo-editor-content").dblclick();
    await expect(member.locator('[data-editing="true"]')).toHaveCount(1);
    await expect(owner.locator('[data-live-lock="memo:memo-1"]')).toContainText("member · editing");
    await finishEditing(member);
    await expect(owner.locator('[data-live-lock="memo:memo-1"]')).toHaveCount(0, { timeout: 15_000 });

    // 다른 카드를 동시에 옮겨도 둘 다 서버에 남는다(새로고침으로 확인).
    const ownerSecond = await memoX(owner, "Second memo");
    await memo(member, "Second memo").locator(".memo-editor-content").dblclick();
    const secondHandle = (await memo(member, "Second memo").locator(".memo-drag-handle").boundingBox())!;
    await member.mouse.move(secondHandle.x + secondHandle.width / 2, secondHandle.y + secondHandle.height / 2);
    await member.mouse.down();
    await member.mouse.move(secondHandle.x + secondHandle.width / 2 + 60, secondHandle.y + secondHandle.height / 2, { steps: 6 });
    await member.mouse.up();
    await finishEditing(member);
    await expect.poll(() => memoX(owner, "Second memo"), { timeout: 15_000 }).toBeGreaterThan(ownerSecond + 30);

    const firstAfterMove = await memoX(owner, "First memo");
    await owner.reload();
    await expect(owner.locator(".board-scroll-layer")).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => memoX(owner, "First memo")).toBe(firstAfterMove);
    await expect.poll(() => memoX(owner, "Second memo")).toBeGreaterThan(ownerSecond + 30);

    // 나가면 남은 사람의 접속자 수가 줄어든다.
    await member.context().close();
    await expect(presence(owner)).toHaveAccessibleName(/1 people/, { timeout: 40_000 });
    await owner.context().close();
});

test("공동 편집자가 기존 주소에서 자동 호스트가 되고 퇴장하면 남은 편집자가 이어받는다", async ({ browser }) => {
    const liveSockets: string[] = [];
    const inspect = (page: Page) => page.on("websocket", (socket) => {
        if (/\/api\/boards\/\d+\/live$/.test(new URL(socket.url()).pathname)) {
            liveSockets.push(socket.url());
        }
    });
    const member = await signedInPage(browser, "member@example.test", 2, inspect);
    await expect(presence(member)).toHaveAccessibleName(/1 people/);

    const owner = await signedInPage(browser, "owner@example.test", 2, inspect);
    await expect(presence(member)).toHaveAccessibleName(/2 people/);
    await expect(presence(owner)).toHaveAccessibleName(/2 people/);
    await member.context().close();
    await expect(presence(owner)).toHaveAccessibleName(/1 people/, { timeout: 40_000 });

    const returning = await signedInPage(browser, "member@example.test", 2, inspect);
    await expect(presence(owner)).toHaveAccessibleName(/2 people/);
    await expect(presence(returning)).toHaveAccessibleName(/2 people/);
    expect((await owner.request.get("/plus/api/boards/2/live")).status()).toBe(405);
    expect(liveSockets).toEqual([]);
    await owner.context().close();
    await returning.context().close();
});

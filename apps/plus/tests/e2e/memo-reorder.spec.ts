import { expect, test } from "@playwright/test";
import { getBoardMenuButton, openTestBoard } from "./helpers";

// Plus는 편집 권한이 있어야 순서를 바꿀 수 있고 CI에는 승인된 계정이 없다.
// 그래서 여기서는 패널이 열리는지와 권한 없는 사용자가 막히는지까지만 본다.

test.describe("메모 순서 변경", () => {
    test.beforeEach(async ({ page }) => {
        const boardExists = await openTestBoard(page);
        test.skip(!boardExists, "E2E 검증에 사용할 보드가 없습니다.");
    });

    test("보드 메뉴에서 순서 패널을 열고 닫는다", async ({ page }) => {
        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reorder Memos" }).click();

        await expect(page.getByRole("heading", { name: "Memo Order" })).toBeVisible();

        await page.getByRole("button", { name: "Close memo order" }).click();
        await expect(page.getByRole("heading", { name: "Memo Order" })).toBeHidden();
    });

    test("메모를 만든 순서대로 줄을 세운다", async ({ page }) => {
        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reorder Memos" }).click();

        const rows = page.locator(".memo-order-row");
        const rowCount = await rows.count();
        test.skip(rowCount === 0, "메모가 있는 보드가 필요합니다.");

        // 화면 연번과 보드 탐색 연번은 같은 순서를 쓴다.
        await expect(rows.first().getByRole("button", { name: "Move memo 1" })).toBeVisible();

        await page.getByRole("button", { name: "Open memo navigator" }).click();
        await expect(page.getByRole("textbox", { name: "Memo number" })).toBeVisible();
        await expect(page.locator("text=/ " + rowCount)).toBeVisible();
    });

    test("편집 권한이 없으면 순서를 바꾸지 못한다", async ({ page }) => {
        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reorder Memos" }).click();

        const rows = page.locator(".memo-order-row");
        const rowCount = await rows.count();
        test.skip(rowCount < 2, "메모가 두 장 이상인 보드가 필요합니다.");

        const handle = (await rows.nth(1).getByRole("button", { name: /^Move memo/ }).boundingBox())!;
        const firstRow = (await rows.first().boundingBox())!;
        const before = await rows.allTextContents();

        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(handle.x + handle.width / 2, firstRow.y + firstRow.height / 2, { steps: 10 });
        await page.mouse.up();

        await expect(page.getByText("Please sign in before editing cards.")).toBeVisible();
        await expect(rows).toHaveText(before);
    });
});

import { expect, test, type Page } from "@playwright/test";
import { openTestBoard } from "./helpers";

const tableCard = (page: Page) => page.locator('[class*="table-rnd-"]');

async function finishEditing(page: Page) {
    const card = page.locator('[data-editing="true"]');
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, Math.max(5, box.y - 40));
    await expect(card).toHaveCount(0);
}

async function openNewTable(page: Page) {
    await page.keyboard.press("t");
    await expect(tableCard(page)).toHaveAttribute("data-editing", "true");
}

test.beforeEach(async ({ page }) => {
    await openTestBoard(page);
});

test("saves text typed into a selected cell", async ({ page }) => {
    await openNewTable(page);
    await tableCard(page).locator("td.meldrift-table-cell").first().click();
    await page.keyboard.type("Hello");
    await page.keyboard.press("Enter");
    await finishEditing(page);

    await expect(tableCard(page).locator("td.meldrift-table-cell").first()).toHaveText("Hello");

    await tableCard(page).dblclick();
    await expect(tableCard(page)).toHaveAttribute("data-editing", "true");
    await expect(tableCard(page).locator("td.meldrift-table-cell").first()).toHaveText("Hello");
});

test("keeps every row visible without scrollbars at the minimum card size", async ({ page }) => {
    await openNewTable(page);
    for (let index = 0; index < 3; index++) {
        await tableCard(page).getByRole("button", { name: /Row$/ }).click();
    }
    await expect(tableCard(page).locator(".meldrift-table-row")).toHaveCount(5);

    const overflow = await tableCard(page).locator(".meldrift-table-scroll").evaluate((scroller) => ({
        vertical: scroller.scrollHeight - scroller.clientHeight,
        horizontal: getComputedStyle(scroller).overflowX,
    }));
    expect(overflow.vertical).toBeLessThanOrEqual(0);
    expect(overflow.horizontal).toBe("hidden");
});

test("keeps a resized row height after reloading", async ({ page }) => {
    await openNewTable(page);
    const firstRow = tableCard(page).locator(".meldrift-table-row").first();
    // 표가 카드 높이를 채우도록 행이 늘어나므로, 엔진이 저장된 높이로 지정한 style.height를 비교한다.
    const savedHeight = () => firstRow.evaluate((row) => Number.parseFloat((row as HTMLElement).style.height));
    const handle = (await firstRow.locator(".meldrift-table-row-resize").boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 40, { steps: 6 });
    await page.mouse.up();

    const resizedHeight = await savedHeight();
    expect(resizedHeight).toBeGreaterThan(37);
    await finishEditing(page);

    await page.waitForTimeout(400);
    await page.reload();
    await expect.poll(savedHeight).toBe(resizedHeight);
});

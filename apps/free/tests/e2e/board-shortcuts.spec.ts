import { expect, test } from "@playwright/test";
import { getBoardToolButton, openTestBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openTestBoard(page);
});

test("toggles selection and drawing back to panning and switches modes exclusively", async ({ page }) => {
    const board = page.locator(".board-scroll-layer");
    const drawing = page.locator('[data-drawing-capture="true"]');

    await page.keyboard.press("1");
    await expect(board).toHaveAttribute("data-selection-active", "true");
    await page.keyboard.press("1");
    await expect(board).not.toHaveAttribute("data-selection-active", "true");

    await page.keyboard.press("2");
    await expect(drawing).toBeAttached();
    await page.keyboard.press("2");
    await expect(drawing).not.toBeAttached();

    await page.keyboard.press("1");
    await expect(board).toHaveAttribute("data-selection-active", "true");
    await page.keyboard.press("2");
    await expect(drawing).toBeAttached();
    await expect(board).not.toHaveAttribute("data-selection-active", "true");
    await page.keyboard.press("1");
    await expect(drawing).not.toBeAttached();
    await expect(board).toHaveAttribute("data-selection-active", "true");
});

for (const [key, cardType] of [["m", "memo"], ["t", "table"], ["d", "mermaid"]]) {
    test(`creates a ${cardType} card with ${key}`, async ({ page }) => {
        const cards = page.locator(`[class*="${cardType}-rnd-"]`);
        const count = await cards.count();
        await page.keyboard.press(key);
        await expect(cards).toHaveCount(count + 1);
        await expect(cards.filter({ has: page.locator('[contenteditable="true"], textarea, input') })).not.toHaveCount(0);
        await expect(page.locator(`[class*="${cardType}-rnd-"][data-editing="true"]`)).toHaveCount(1);
    });
}

test("opens the image chooser with i", async ({ page }) => {
    const chooserPromise = page.waitForEvent("filechooser");
    await page.keyboard.press("i");
    const chooser = await chooserPromise;
    expect(await chooser.element().getAttribute("aria-label")).toBe("Upload image");
});

test("does not trigger shortcuts while editing a memo or typing into search", async ({ page }) => {
    await getBoardToolButton(page, "lucide-search").click();
    const search = page.getByPlaceholder("Search memos");
    await search.pressSequentially("m12itd");
    await expect(search).toHaveValue("m12itd");
    await expect(page.locator('[data-drawing-capture="true"]')).not.toBeAttached();
    await expect(page.locator('[data-editing="true"]')).toHaveCount(0);

    await page.locator(".board-scroll-layer").click({ position: { x: 10, y: 200 } });
    await page.keyboard.press("m");
    const memo = page.locator('[class*="memo-rnd-"][data-editing="true"]');
    await expect(memo).toHaveCount(1);
    const editor = memo.locator('[contenteditable="true"]');
    await editor.pressSequentially("m12itd");
    await expect(editor).toContainText("m12itd");
    await expect(page.locator('[data-editing="true"]')).toHaveCount(1);
    await expect(page.locator('[data-drawing-capture="true"]')).not.toBeAttached();
});

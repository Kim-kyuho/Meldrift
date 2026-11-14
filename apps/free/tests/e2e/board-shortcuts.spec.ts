import { expect, test } from "@playwright/test";
import { getBoardToolButton, openTestBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openTestBoard(page);
});

test("선택·드로잉에서 패닝으로 전환하고 두 모드가 동시에 활성화되지 않게 한다", async ({ page }) => {
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
    test(`${key} 키로 ${cardType} 카드를 생성한다`, async ({ page }) => {
        const cards = page.locator(`[class*="${cardType}-rnd-"]`);
        const count = await cards.count();
        await page.keyboard.press(key);
        await expect(cards).toHaveCount(count + 1);
        if (cardType === "mermaid") {
            // 데스크톱은 에디터가 카드 밖 편집 패널에, 모바일은 카드 안에 뜬다.
            await expect(page.getByLabel("Mermaid source")).toBeVisible();
        } else {
            await expect(cards.filter({ has: page.locator('[contenteditable="true"], textarea, input') })).not.toHaveCount(0);
        }
        await expect(page.locator(`[class*="${cardType}-rnd-"][data-editing="true"]`)).toHaveCount(1);
    });
}

test("i 키로 이미지 선택창을 연다", async ({ page }) => {
    const chooserPromise = page.waitForEvent("filechooser");
    await page.keyboard.press("i");
    const chooser = await chooserPromise;
    expect(await chooser.element().getAttribute("aria-label")).toBe("Upload image");
});

test("메모 편집이나 검색어 입력 중에는 단축키를 실행하지 않는다", async ({ page }) => {
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

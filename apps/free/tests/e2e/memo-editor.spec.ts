import { expect, test, type Page } from "@playwright/test";
import { getBoardToolButton, openTestBoard } from "./helpers";

const editor = (page: Page) => page.locator('.card-editing [contenteditable="true"]');
const memoContent = (page: Page) => page.locator('[class*="memo-rnd-"] .memo-editor-content');
const memoTools = (page: Page) => page.locator("#card-tool-portal");

async function finishEditing(page: Page) {
    const card = page.locator('[data-editing="true"]');
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, Math.max(5, box.y - 40));
    await expect(card).toHaveCount(0);
}

async function openNewMemo(page: Page, text: string) {
    await getBoardToolButton(page, "lucide-square-pen").click();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type(text);
}

async function selectPreviousCharacters(page: Page, count: number) {
    for (let index = 0; index < count; index++) {
        await page.keyboard.press("Shift+ArrowLeft");
    }
}

test.beforeEach(async ({ page }) => {
    await openTestBoard(page);
});

test("keeps markdown formatting after saving and reopening a memo", async ({ page }) => {
    await openNewMemo(page, "## Title");
    await page.keyboard.press("Enter");
    await page.keyboard.type("**bold** and ==mark== ");
    await finishEditing(page);

    await expect(memoContent(page).locator("h2")).toHaveText("Title");
    await expect(memoContent(page).locator("strong")).toHaveText("bold");
    await expect(memoContent(page).locator("mark")).toHaveText("mark");
    const savedHtml = await memoContent(page).innerHTML();

    // 저장된 HTML을 편집기로 다시 불러와도 태그가 글자로 보이지 않아야 한다.
    await memoContent(page).dblclick();
    await expect(editor(page).locator("h2")).toHaveText("Title");
    await expect(editor(page).locator("strong")).toHaveText("bold");
    await expect(editor(page)).not.toContainText("<h2>");
    await finishEditing(page);

    expect(await memoContent(page).innerHTML()).toBe(savedHtml);
});

test("toggles inline formats from the memo toolbar", async ({ page }) => {
    await openNewMemo(page, "abc def");
    await selectPreviousCharacters(page, 3);
    await memoTools(page).getByRole("button", { name: "Text formatting" }).click();

    for (const [name, selector] of [
        ["Bold", "b, strong"],
        ["Italic", "i, em"],
        ["Highlight", "mark"],
        ["Strike", "strike, del, s"],
    ]) {
        await memoTools(page).getByRole("button", { name }).click();
        await expect(editor(page).locator(selector)).toHaveText("def");

        await memoTools(page).getByRole("button", { name }).click();
        await expect(editor(page).locator(selector)).toHaveCount(0);
    }
});

test("toggles headings from the memo toolbar", async ({ page }) => {
    await openNewMemo(page, "abc");
    await memoTools(page).getByRole("button", { name: "Text formatting" }).click();

    // H1~H3는 엔진 exec, H4~H6는 브라우저 명령으로 처리한다.
    for (const level of [2, 4]) {
        await memoTools(page).getByRole("button", { name: "Heading" }).click();
        await memoTools(page).getByRole("button", { name: `H${level}` }).click();
        await expect(editor(page).locator(`h${level}`)).toHaveText("abc");

        await memoTools(page).getByRole("button", { name: "Heading" }).click();
        await memoTools(page).getByRole("button", { name: `H${level}` }).click();
        await expect(editor(page).locator(`h${level}`)).toHaveCount(0);
    }
});

test("toggles quote and code blocks from the memo toolbar", async ({ page }) => {
    await openNewMemo(page, "abc");
    await memoTools(page).getByRole("button", { name: "Block formatting" }).click();

    for (const [name, selector] of [
        ["Block quote", "blockquote"],
        ["Code block", "pre"],
    ]) {
        await memoTools(page).getByRole("button", { name }).click();
        await expect(editor(page).locator(selector)).toHaveText("abc");

        await memoTools(page).getByRole("button", { name }).click();
        await expect(editor(page).locator(selector)).toHaveCount(0);
    }

    await expect(editor(page).locator("p")).toHaveText("abc");
});

test("continues typing in a paragraph after a divider at the end", async ({ page }) => {
    await openNewMemo(page, "abc");
    await memoTools(page).getByRole("button", { name: "Block formatting" }).click();
    await memoTools(page).getByRole("button", { name: "Divider" }).click();
    await page.keyboard.type("def");
    await expect(editor(page).locator("hr + p")).toHaveText("def");

    await finishEditing(page);
    await expect(memoContent(page).locator("hr + p")).toHaveText("def");
});

import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getBoardMenuButton, getBoardToolButton, openTestBoard } from "./helpers";

const history = (page: Page) => page.getByRole("toolbar", { name: "Board history" });
const undo = (page: Page) => history(page).getByRole("button", { name: "Undo board change" });
const redo = (page: Page) => history(page).getByRole("button", { name: "Redo board change" });

async function finishEditing(page: Page) {
    const card = page.locator('[data-editing="true"]');
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, Math.max(5, box.y - 40));
    await expect(card).toHaveCount(0);
}

async function addMemo(page: Page, content: string) {
    await getBoardToolButton(page, "lucide-square-pen").click();
    await page.locator('.card-editing [contenteditable="true"]').fill(content);
    await expect(undo(page)).toBeDisabled();
    await finishEditing(page);
    await expect(undo(page)).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
    await openTestBoard(page);
});

for (const [key, type] of [["m", "memo"], ["t", "table"], ["d", "mermaid"]]) {
    test(`undoes and redoes ${type} creation without recording restoration`, async ({ page }) => {
        await page.keyboard.press(key);
        await expect(page.locator(`[class*="${type}-rnd-"][data-editing="true"]`)).toBeVisible();
        await finishEditing(page);
        await expect(undo(page)).toBeEnabled();
        await undo(page).click();
        await expect(page.locator(`[class*="${type}-rnd-"]`)).toHaveCount(0);
        await expect(undo(page)).toBeDisabled();
        await redo(page).click();
        await expect(page.locator(`[class*="${type}-rnd-"]`)).toHaveCount(1);
        await expect(redo(page)).toBeDisabled();
    });
}

test("records memo movement and resize separately and restores the rendered geometry", async ({ page }) => {
    await addMemo(page, "Geometry history");
    const card = page.locator('[class*="memo-rnd-"]');
    const geometry = () => card.evaluate((element: HTMLElement) => {
        const position = new DOMMatrixReadOnly(element.style.transform);
        return {
            x: Math.round(position.m41),
            y: Math.round(position.m42),
            width: Math.round(Number.parseFloat(element.style.width)),
            height: Math.round(Number.parseFloat(element.style.height)),
        };
    });
    const originalGeometry = await geometry();
    await card.locator(".memo-editor-content").dblclick();
    const handle = (await card.locator(".memo-drag-handle").boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 - 30, handle.y + handle.height / 2 + 20, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await geometry()).x).toBeLessThan(originalGeometry.x - 10);
    await expect.poll(async () => (await geometry()).y).toBeGreaterThan(originalGeometry.y + 10);
    const movedGeometry = await geometry();
    const corner = card.locator('div[style*="cursor: se-resize"]').last();
    const cornerBox = (await corner.boundingBox())!;
    await page.mouse.move(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cornerBox.x + cornerBox.width / 2 + 30, cornerBox.y + cornerBox.height / 2 + 20, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => (await geometry()).width).toBeGreaterThan(movedGeometry.width + 10);
    await expect.poll(async () => (await geometry()).height).toBeGreaterThan(movedGeometry.height + 10);
    await finishEditing(page);
    await undo(page).click();
    await expect.poll(geometry).toEqual(movedGeometry);
    await undo(page).click();
    await expect.poll(geometry).toEqual(originalGeometry);
    await undo(page).click();
    await expect(card).toHaveCount(0);
});

for (const [key, type] of [["m", "memo"], ["t", "table"], ["d", "mermaid"]]) {
    test(`restores ${type} content in the card renderer`, async ({ page }) => {
        await page.keyboard.press(key);
        const card = page.locator(`[class*="${type}-rnd-"]`);
        const fill = async (text: string) => {
            if (type === "memo") {
                await card.locator('[contenteditable="true"]').fill(text);
            } else if (type === "table") {
                await card.getByRole("textbox", { name: "Column name" }).first().fill(text);
            } else {
                await page.getByLabel("Mermaid source").fill(`flowchart TD\nA[${text}] --> B[End]`);
            }
        };
        await fill("Original content");
        await finishEditing(page);
        await card.dblclick();
        await expect(card).toHaveAttribute("data-editing", "true");
        await fill("Changed content");
        await finishEditing(page);
        await expect(card).toContainText("Changed content");
        await undo(page).click();
        await expect(card).toContainText("Original content");
        await expect(card).not.toContainText("Changed content");
        await redo(page).click();
        await expect(card).toContainText("Changed content");
    });
}

test("restores memo order as one operation", async ({ page }) => {
    await addMemo(page, "Alpha order");
    await addMemo(page, "Beta order");
    await getBoardMenuButton(page).click();
    await page.getByRole("button", { name: "Reorder Memos" }).click();
    const rows = page.locator(".memo-order-row");
    const handle = (await rows.nth(1).getByRole("button", { name: /^Move memo/ }).boundingBox())!;
    const destination = (await rows.nth(0).boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, destination.y + destination.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(rows).toHaveText([/Beta order/, /Alpha order/]);
    await undo(page).click();
    await expect(rows).toHaveText([/Alpha order/, /Beta order/]);
    await redo(page).click();
    await expect(rows).toHaveText([/Beta order/, /Alpha order/]);
});

test("restores a multi-card selection move as one operation", async ({ page }) => {
    await addMemo(page, "Alpha move");
    await addMemo(page, "Beta move");
    const cards = page.locator('[class*="memo-rnd-"]');
    const original = (await cards.first().boundingBox())!;
    await page.keyboard.press("1");
    await page.mouse.move(original.x - 10, original.y - 10);
    await page.mouse.down();
    await page.mouse.move(original.x + original.width + 10, original.y + original.height + 10, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-selection-box="true"]')).toBeVisible();
    await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2);
    await page.mouse.down();
    await page.mouse.move(original.x + original.width / 2 + 30, original.y + original.height / 2 + 20, { steps: 8 });
    await page.mouse.up();
    expect((await cards.first().boundingBox())!.x).toBeGreaterThan(original.x);
    await undo(page).click();
    expect((await cards.first().boundingBox())!.x).toBeCloseTo(original.x, 0);
    expect((await cards.last().boundingBox())!.x).toBeCloseTo(original.x, 0);
    await expect(page.locator('[data-selection-box="true"]')).toHaveCount(0);
    await redo(page).click();
    expect((await cards.first().boundingBox())!.x).toBeGreaterThan(original.x);
    expect((await cards.last().boundingBox())!.x).toBeGreaterThan(original.x);
});

test("restores a deleted image from its binary data", async ({ page }) => {
    await page.getByLabel("Upload image").setInputFiles({ name: "history.png", mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=", "base64") });
    const image = page.getByRole("img", { name: "history.png" });
    await expect(image).toBeVisible();
    await finishEditing(page);
    await image.dblclick();
    await page.getByRole("button", { name: "Delete image" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes", exact: true }).click();
    await expect(image).toHaveCount(0);
    await undo(page).click();
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    await redo(page).click();
    await expect(image).toHaveCount(0);
});

test("groups an eraser gesture and uses the common history from the drawing toolbar", async ({ page }) => {
    await page.keyboard.press("2");
    const drawing = page.locator('[data-drawing-capture="true"]');
    const drawLine = async (y: number) => {
        await page.mouse.move(120, y);
        await page.mouse.down();
        await expect(undo(page)).toBeDisabled();
        await page.mouse.move(250, y, { steps: 20 });
        await page.mouse.up();
    };
    await drawLine(200);
    await drawLine(300);
    const paths = drawing.locator("svg path");
    const before = await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
    await page.locator("#card-tool-portal button").filter({ has: page.locator("svg.lucide-eraser") }).click();
    await page.mouse.move(150, 190);
    await page.mouse.down();
    await page.mouse.move(220, 210, { steps: 12 });
    await page.mouse.up();
    const erased = await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
    expect(erased).not.toEqual(before);
    await undo(page).click();
    expect(await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")))).toEqual(before);
    await redo(page).click();
    expect(await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")))).toEqual(erased);
    await page.locator("#card-tool-portal").getByRole("button", { name: "Undo board change" }).click();
    expect(await paths.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")))).toEqual(before);
    await undo(page).click();
    await expect(paths).toHaveCount(1);
});

test("undoes Reset and Import as complete board replacements", async ({ page }) => {
    await addMemo(page, "Before import");
    await getBoardMenuButton(page).click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const file = await downloaded;
    const bytes = await readFile((await file.path())!);
    await addMemo(page, "After export");
    await getBoardMenuButton(page).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Yes", exact: true }).click();
    await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(0);
    await undo(page).click();
    await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(2);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByLabel("Import board database").setInputFiles({ name: "history.sqlite", mimeType: "application/vnd.sqlite3", buffer: bytes });
    await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(1);
    await undo(page).click();
    await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(2);
    await redo(page).click();
    await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(1);
});

test("drops future history after a new edit and stores the restored state locally", async ({ page }) => {
    await addMemo(page, "Alpha history");
    await addMemo(page, "Beta history");
    await undo(page).click();
    await addMemo(page, "Gamma history");
    await expect(redo(page)).toBeDisabled();
    await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(2);
    await undo(page).click();
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(1);
    await expect(page.locator(".memo-editor-content")).toContainText("Alpha history");
    await expect(undo(page)).toBeDisabled();
    await expect(redo(page)).toBeDisabled();
});

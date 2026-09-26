import { expect, test, type Page } from "@playwright/test";
import { getBoardToolButton, openTestBoard } from "./helpers";
import { createDeltaServer } from "./delta-server";

test.describe.configure({ timeout: 90000 });

const saved = (page: Page) => page.getByRole("status").filter({ hasText: /^Saved$/ });

async function openBoard(page: Page) {
    expect(await openTestBoard(page), "A board metadata fixture is required for delta E2E").toBe(true);
    await expect(saved(page)).toBeVisible({ timeout: 20000 });
}

async function finishEditing(page: Page) {
    const editing = page.locator(".card-editing");
    const box = (await editing.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, Math.max(5, box.y - 40));
    await expect(editing).toHaveCount(0);
}

async function addMemo(page: Page, text: string) {
    await getBoardToolButton(page, "lucide-square-pen").click();
    await page.locator('.card-editing [contenteditable="true"]').fill(text);
    await finishEditing(page);
}

async function redImage(page: Page) {
    const base64 = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#ff0000";
        context.fillRect(0, 0, 128, 128);
        return canvas.toDataURL("image/png").split(",")[1];
    });
    return { name: "delta-red.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

test("syncs three identical images separately and restores them from the server in a fresh browser context", async ({ page, context, browser }) => {
    const server = createDeltaServer();
    await server.install(context);
    await openBoard(page);
    const file = await redImage(page);
    for (let index = 0; index < 3; index += 1) {
        await page.getByLabel("Upload image").setInputFiles(file);
        await expect(page.locator(".card-editing img")).toBeVisible();
        await finishEditing(page);
    }
    await expect.poll(() => server.changes.flatMap((change) => change.operations)
        .filter((op) => op.type === "image" && op.action === "create").length, { timeout: 20000 }).toBe(3);
    await expect(saved(page)).toBeVisible();
    expect(server.chunkUploads).toHaveLength(3);

    const fresh = await browser.newContext();
    try {
        await server.install(fresh);
        const restored = await fresh.newPage();
        await restored.goto(page.url());
        const images = restored.getByRole("img", { name: file.name });
        await expect(images).toHaveCount(3, { timeout: 20000 });
        await expect.poll(() => images.evaluateAll((nodes) => nodes.every((node) =>
            (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
        expect(server.chunkDownloads).toHaveLength(3);
        expect(server.chunkUploads).toHaveLength(3);
        expect(server.unexpected).toEqual([]);
    } finally { await fresh.close(); }
});

test("moving an image sends geometry only and captures its pixels in the preview", async ({ page, context }, testInfo) => {
    const server = createDeltaServer();
    await server.install(context);
    await openBoard(page);
    await page.getByLabel("Upload image").setInputFiles(await redImage(page));
    await expect(page.locator(".card-editing img")).toBeVisible();
    await finishEditing(page);
    await expect.poll(() => server.changes.length, { timeout: 15000 }).toBe(1);
    await expect(saved(page)).toBeVisible();
    const initialBytes = server.chunkUploads.length;
    const image = page.getByRole("img", { name: "delta-red.png" });
    await image.dblclick();
    await expect(page.locator(".card-editing")).toBeVisible();
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 8 });
    await page.mouse.up();
    await finishEditing(page);
    await expect.poll(() => server.changes.length, { timeout: 15000 }).toBe(2);
    const [operation] = server.changes[1].operations;
    expect(operation.action).toBe("update");
    expect(Object.keys(operation.changes).sort()).toEqual(["x", "y"]);
    expect(operation.asset).toBeUndefined();
    expect(server.chunkUploads).toHaveLength(initialBytes);
    await expect.poll(() => server.previews.length, { timeout: 15000 }).toBeGreaterThan(0);
    const preview = server.previews.at(-1)!;
    await testInfo.attach("uploaded-preview", { body: preview.bytes, contentType: preview.mimeType });
    const redPixels = await page.evaluate(async ({ base64, mimeType }) => {
        const image = new Image();
        image.src = `data:${mimeType};base64,${base64}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let count = 0;
        for (let index = 0; index < data.length; index += 4) {
            if (data[index] > 200 && data[index + 1] < 60 && data[index + 2] < 60) count++;
        }
        return count;
    }, { base64: preview.bytes.toString("base64"), mimeType: preview.mimeType });
    expect(redPixels).toBeGreaterThan(100);
    expect(server.unexpected).toEqual([]);
});

test("keeps failed changes in IndexedDB across reload and retries the same mutation", async ({ page, context }) => {
    const server = createDeltaServer();
    await server.install(context);
    await openBoard(page);
    server.setOffline(true);
    await addMemo(page, "Offline delta memo");
    await expect(page.getByRole("status").filter({ hasText: "Simulated offline storage" })).toBeVisible({ timeout: 15000 });
    const mutation = server.attempts[0].mutationId;
    expect(server.changes).toHaveLength(0);
    await page.reload();
    await expect(page.getByText("Offline delta memo", { exact: true })).toBeVisible({ timeout: 20000 });
    server.setOffline(false);
    await expect(saved(page)).toBeVisible({ timeout: 20000 });
    expect(server.changes).toHaveLength(1);
    expect(server.attempts.every((attempt) => attempt.mutationId === mutation)).toBe(true);
    expect(server.unexpected).toEqual([]);
});

test("recovers a committed mutation after its response is lost without creating a duplicate", async ({ page, context }) => {
    const server = createDeltaServer();
    await server.install(context);
    await openBoard(page);
    server.loseNextResponse();
    await addMemo(page, "Accepted delta memo");
    await expect.poll(() => server.changes.length, { timeout: 15000 }).toBe(1);
    await page.reload();
    await expect(page.getByText("Accepted delta memo", { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(saved(page)).toBeVisible({ timeout: 10000 });
    expect(server.changes).toHaveLength(1);
    expect(server.unexpected).toEqual([]);
});

test("resumes a multi-chunk image after a failed chunk without resending completed chunks", async ({ page, context }) => {
    const server = createDeltaServer();
    await server.install(context);
    await openBoard(page);
    const base64 = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1920;
        const context = canvas.getContext("2d")!;
        const pixels = context.createImageData(1920, 1920);
        let seed = 12345;
        for (let index = 0; index < pixels.data.length; index += 4) {
            for (let channel = 0; channel < 3; channel++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                pixels.data[index + channel] = seed >>> 24;
            }
            pixels.data[index + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
    });
    server.failNextChunk(1);
    await page.getByLabel("Upload image").setInputFiles({
        name: "multi-chunk.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64"),
    });
    await expect(page.locator(".card-editing img")).toBeVisible();
    await finishEditing(page);
    await expect(page.getByRole("status").filter({ hasText: "Simulated chunk failure" })).toBeVisible({ timeout: 15000 });
    expect(server.chunkUploads).toHaveLength(1);
    expect(server.changes).toHaveLength(0);
    await expect(saved(page)).toBeVisible({ timeout: 20000 });
    expect(server.changes).toHaveLength(1);
    expect(server.chunkUploads.length).toBeGreaterThan(1);
    expect(new Set(server.chunkUploads.map((chunk) => chunk.toString("base64"))).size).toBe(server.chunkUploads.length);
    expect(server.unexpected).toEqual([]);
});

test("sends one operation per edit and never resends an untouched card", async ({ page, context }) => {
    const server = createDeltaServer();
    await server.install(context);
    await openBoard(page);
    await addMemo(page, "Untouched delta memo");
    await addMemo(page, "Rewritten delta memo");
    await expect.poll(() => server.changes.flatMap((change) => change.operations)
        .filter((operation) => operation.action === "create").length, { timeout: 20000 }).toBe(2);
    await expect(saved(page)).toBeVisible();
    const committed = server.changes.length;

    await page.getByText("Rewritten delta memo", { exact: true }).dblclick();
    await page.locator('.card-editing [contenteditable="true"]').selectText();
    await page.keyboard.type("Rewritten delta memo, second pass");
    await finishEditing(page);

    await expect.poll(() => server.changes.length, { timeout: 20000 }).toBe(committed + 1);
    const rewrite = server.changes.at(-1)!;
    expect(rewrite.operations).toHaveLength(1);
    expect(rewrite.operations[0]).toMatchObject({ type: "memo", action: "update" });
    expect(String(rewrite.operations[0].changes.content)).toContain("second pass");

    await page.getByText("Rewritten delta memo, second pass", { exact: true }).dblclick();
    await page.getByRole("button", { name: "Delete memo" }).click();
    await page.getByRole("button", { name: "Yes", exact: true }).click();

    await expect.poll(() => server.changes.length, { timeout: 20000 }).toBe(committed + 2);
    const removal = server.changes.at(-1)!;
    expect(removal.operations).toHaveLength(1);
    expect(removal.operations[0]).toMatchObject({ type: "memo", action: "delete", changes: {} });
    expect(removal.operations[0].syncId).toBe(rewrite.operations[0].syncId);

    await expect(page.getByText("Untouched delta memo", { exact: true })).toBeVisible();
    await expect(page.getByText("Rewritten delta memo, second pass", { exact: true })).toHaveCount(0);
    expect(server.unexpected).toEqual([]);
});

test("opens the same board in a second tab and commits from it", async ({ page, context }) => {
    const server = createDeltaServer();
    await server.install(context);
    await openBoard(page);

    const second = await context.newPage();
    try {
        await second.goto(page.url());
        await expect(second.locator(".board-scroll-layer")).toBeVisible({ timeout: 20000 });
        await expect(saved(second)).toBeVisible({ timeout: 20000 });

        await addMemo(second, "Second tab delta memo");
        await expect.poll(() => server.changes.length, { timeout: 20000 }).toBe(1);
        expect(String(server.changes[0].operations[0].changes.content)).toContain("Second tab delta memo");
        await expect(saved(second)).toBeVisible({ timeout: 20000 });
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
    } finally {
        await second.close();
    }
    expect(server.unexpected).toEqual([]);
});

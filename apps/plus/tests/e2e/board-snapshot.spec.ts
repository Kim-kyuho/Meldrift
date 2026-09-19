import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { getBoardToolButton } from "./helpers";

test.describe.configure({ timeout: 60000 });

// Only board metadata is read from Neon. Every browser API request is intercepted.
async function mockSnapshotServer(context: BrowserContext, initialLoadDelayMs = 0) {
    let bytes: Buffer | null = null;
    let revision = 0;
    let mutation = "";
    let failUploads = false;
    const uploads: Buffer[] = [];
    const legacyWrites: string[] = [];
    await context.route("**/api/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^\/plus/, "");
        if (path === "/api/me") return route.fulfill({ json: { user: { email: "snapshot-e2e@example.test", isApproved: true, role: "user" } } });
        const match = path.match(/^\/api\/boards\/(\d+)\/snapshot$/);
        if (match) {
            if (request.method() === "PUT") {
                if (failUploads) return route.fulfill({ status: 503, json: { message: "Simulated offline storage" } });
                expect(Number(request.headers()["x-snapshot-revision"])).toBe(revision);
                bytes = request.postDataBuffer()!;
                expect(bytes.subarray(0, 16).toString()).toBe("SQLite format 3\0");
                mutation = request.headers()["x-snapshot-mutation"];
                revision += 1;
                uploads.push(bytes);
                return route.fulfill({ json: { ok: true, revision } });
            }
            if (bytes) return route.fulfill({ body: bytes, headers: {
                "Content-Type": "application/vnd.sqlite3", "X-Snapshot-Revision": String(revision), "X-Snapshot-Mutation": mutation,
            } });
            if (initialLoadDelayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, initialLoadDelayMs));
                initialLoadDelayMs = 0;
            }
            return route.fulfill({ json: { revision: 0, legacy: {
                board: { boardId: Number(match[1]), title: "Snapshot test", width: 7680, height: 4320 },
                memos: [], images: [], mermaids: [], tables: [], strokes: [],
            } } });
        }
        if (path.endsWith("/preview")) return route.fulfill({ json: { ok: true } });
        if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) legacyWrites.push(path);
        return route.fulfill({ json: { ok: true, unlocked: false } });
    });
    return { uploads, legacyWrites, setOffline: (value: boolean) => { failUploads = value; } };
}

async function openBoard(page: Page) {
    if (process.env.E2E_BOARD_ID) {
        await page.goto(`/plus/boards/${process.env.E2E_BOARD_ID}`);
    } else {
        await page.goto("/plus");
        const link = page.locator('a[href^="/plus/boards/"]').first();
        await expect(link, "A board metadata fixture is required").toBeVisible();
        await link.click();
    }
    // Client-side navigation includes cold dev compilation and SQLite worker initialization.
    await expect(page.locator(".board-scroll-layer")).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("status", { name: "" }).filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 10000 });
}

async function saveEditingCard(page: Page) {
    const card = page.locator(".card-editing");
    const box = (await card.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, Math.max(5, box.y - 40));
    await expect(card).toHaveCount(0);
}

async function createMemo(page: Page, text: string) {
    await getBoardToolButton(page, "lucide-square-pen").click();
    await page.locator('.card-editing [contenteditable="true"]').fill(text);
    await saveEditingCard(page);
}

test("persists locally, uploads SQLite after debounce, and restores memo and image after reload", async ({ page, context }) => {
    const server = await mockSnapshotServer(context);
    await openBoard(page);
    const baseline = server.uploads.length;
    await createMemo(page, "Snapshot persisted memo");
    await expect(page.getByRole("status").filter({ hasText: /^Saved locally$/ })).toBeVisible();
    expect(server.uploads).toHaveLength(baseline);
    await expect.poll(() => server.uploads.length, { timeout: 10000 }).toBe(baseline + 1);
    expect(server.uploads.at(-1)!.includes(Buffer.from("Snapshot persisted memo"))).toBe(true);

    await page.getByLabel("Upload image").setInputFiles({
        name: "snapshot.png", mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=", "base64"),
    });
    await expect(page.locator(".card-editing img")).toBeVisible();
    await saveEditingCard(page);
    await expect.poll(() => server.uploads.length, { timeout: 10000 }).toBe(baseline + 2);
    await page.reload();
    await expect(page.getByText("Snapshot persisted memo", { exact: true })).toBeVisible();
    const image = page.getByRole("img", { name: "snapshot.png" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    expect(server.legacyWrites).toEqual([]);
});

test("exports, resets and imports the current board without resetting its server revision", async ({ page, context }) => {
    const server = await mockSnapshotServer(context);
    await openBoard(page);
    await createMemo(page, "Original imported memo");
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Open board menu" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    const filePath = (await download.path())!;

    await page.getByRole("button", { name: "Open board menu" }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(page.getByText("Original imported memo", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: /^Saved locally$/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 10000 });

    await createMemo(page, "Replacement with the same ID");
    await page.getByRole("button", { name: "Open board menu" }).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    const chooser = await chooserPromise;
    page.once("dialog", (dialog) => dialog.accept());
    await chooser.setFiles(filePath);
    await expect(page.getByText("Original imported memo", { exact: true })).toBeVisible();
    await expect(page.getByText("Replacement with the same ID", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: /^Saved locally$/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByText("Original imported memo", { exact: true })).toBeVisible();
    expect(server.legacyWrites).toEqual([]);
});

test("waits for board initialization that exceeds the default assertion timeout", async ({ page, context }) => {
    const server = await mockSnapshotServer(context, 6000);
    await openBoard(page);
    expect(server.uploads).toHaveLength(1);
    expect(server.legacyWrites).toEqual([]);
});

test("retains unsynced edits through reload and opens the board in a second tab", async ({ page, context }) => {
    const server = await mockSnapshotServer(context);
    await openBoard(page);
    server.setOffline(true);
    await createMemo(page, "Recover this local memo");
    await expect(page.getByRole("status").filter({ hasText: "Simulated offline storage" })).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByText("Recover this local memo", { exact: true })).toBeVisible();
    const second = await context.newPage();
    await second.goto(page.url());
    await expect(second.getByText("Recover this local memo", { exact: true })).toBeVisible({ timeout: 20000 });
    await second.close();
    server.setOffline(false);
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 15000 });
    expect(server.legacyWrites).toEqual([]);
});

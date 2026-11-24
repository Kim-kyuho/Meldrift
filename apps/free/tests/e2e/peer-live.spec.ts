import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { boardDatabaseContainsText, getBoardMenuButton, getBoardToolButton, openTestBoard } from "./helpers";

const memo = (page: Page, content: string) => page.locator('[class*="memo-rnd-"]').filter({ hasText: content });
const connected = (page: Page) => page.getByRole("button", { name: /Live collaboration connected/ });

async function addMemo(page: Page, content: string) {
    await getBoardToolButton(page, "lucide-square-pen").click();
    const card = page.locator('[data-editing="true"]');
    await card.locator('[contenteditable="true"]').fill(content);
    await page.locator(".board-scroll-layer").click({ position: { x: 100, y: 160 } });
    await expect(card).toHaveCount(0);
}

async function startRoom(host: Page) {
    await getBoardMenuButton(host).click();
    const start = host.getByRole("button", { name: "Start collaboration", exact: true });
    await expect(start).toHaveCSS("border-top-width", "1px");
    await start.click();
    await host.getByLabel("Your display name").fill("Host");
    const submit = host.getByRole("button", { name: "Start room" });
    await expect(submit).toHaveCSS("border-top-width", "1px");
    await submit.click();
    const invitation = host.getByRole("textbox", { name: "Invitation link" });
    await expect(invitation).toBeVisible();
    return invitation.inputValue();
}

async function askToJoin(page: Page, url: string, name: string) {
    await page.goto(url);
    await page.getByLabel("Your display name").fill(name);
    await page.getByRole("button", { name: "Ask to join" }).click();
}

test("shares a Free board directly, persists guest edits on the host, and isolates the guest's personal board", async ({ page: host, browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "This flow uses a desktop host.");
    test.setTimeout(70_000);
    const guestContext = await browser.newContext({ baseURL });
    try {
        const guest = await guestContext.newPage();
        await openTestBoard(guest);
        await addMemo(guest, "Guest personal memo");
        await expect.poll(() => boardDatabaseContainsText(guest, "Guest personal memo")).toBe(true);

        await openTestBoard(host);
        await addMemo(host, "Host's shared memo");
        const sharedUrl = await startRoom(host);
        await host.getByRole("button", { name: "Done", exact: true }).click();
        await askToJoin(guest, sharedUrl, "Collaborator");
        await expect(guest.locator(".board-scroll-layer")).toHaveCount(0);
        const joinRequest = host.getByRole("button", { name: "1 join request" });
        await expect(joinRequest).toHaveCSS("animation-name", "meldriftAttentionGlow", { timeout: 12_000 });
        await host.emulateMedia({ reducedMotion: "reduce" });
        await expect(joinRequest).toHaveCSS("animation-name", "none");
        await joinRequest.click();
        const request = host.getByRole("listitem").filter({ hasText: "Collaborator" });
        await expect(request.getByText("Join request", { exact: true })).toBeVisible();
        const allow = request.getByRole("button", { name: "Allow editing" });
        await expect(allow).toHaveText("Allow");
        await expect(request.getByRole("button", { name: "View only" })).toHaveText("Viewer");
        await allow.click({ timeout: 12_000 });
        await expect(connected(guest)).toBeVisible({ timeout: 25_000 });
        await expect(memo(guest, "Host's shared memo")).toHaveCount(1);
        await expect(memo(guest, "Guest personal memo")).toHaveCount(0);
        await host.getByRole("button", { name: "Done", exact: true }).click();

        await memo(host, "Host's shared memo").locator(".memo-editor-content").dblclick();
        await expect(guest.getByRole("note", { name: "Host is editing this card" })).toBeVisible();
        await addMemo(guest, "Committed by the guest");
        await expect(memo(host, "Committed by the guest")).toHaveCount(1);
        await expect.poll(() => boardDatabaseContainsText(host, "Committed by the guest")).toBe(true);
        await expect(host.locator('[data-editing="true"]')).toHaveCount(1);
        await host.locator(".board-scroll-layer").click({ position: { x: 100, y: 160 } });

        await guest.reload();
        await expect(connected(guest)).toBeVisible({ timeout: 25_000 });
        await expect(memo(guest, "Committed by the guest")).toHaveCount(1);
        await addMemo(guest, "Committed after reconnecting");
        await expect(memo(host, "Committed after reconnecting")).toHaveCount(1);

        await getBoardMenuButton(host).click();
        await host.getByRole("button", { name: "Manage collaboration" }).click();
        await host.getByRole("button", { name: "End room" }).click();
        await expect(guest.getByRole("link", { name: "My board", exact: true })).toBeVisible({ timeout: 25_000 });
        await guest.getByRole("link", { name: "My board", exact: true }).click();
        await expect(memo(guest, "Guest personal memo")).toHaveCount(1);
        await expect(memo(guest, "Committed by the guest")).toHaveCount(0);
        await host.reload();
        await expect(memo(host, "Committed by the guest")).toHaveCount(1);
        await expect(memo(host, "Committed after reconnecting")).toHaveCount(1);
    } finally {
        await guestContext.close();
    }
});

test("shares an image with seven connected guests and honors a read-only seat", async ({ page: host, browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "This flow uses a desktop host.");
    test.setTimeout(90_000);
    const guests = await browser.newContext({ baseURL });
    try {
        await openTestBoard(host);
        const url = await startRoom(host);
        const pages = await Promise.all(Array.from({ length: 7 }, () => guests.newPage()));
        await Promise.all(pages.map((page, index) => askToJoin(page, url, `Participant ${index + 1}`)));
        const seats = host.getByRole("list", { name: "Room participants" }).getByRole("listitem");
        await expect(seats).toHaveCount(7, { timeout: 15_000 });
        for (const [index] of pages.entries()) {
            const seat = seats.filter({ hasText: `Participant ${index + 1}` });
            await seat.getByRole("button", { name: index === 0 ? "Allow editing" : "View only" }).click();
        }
        await Promise.all(pages.map((page) => expect(connected(page)).toBeVisible({ timeout: 25_000 })));
        await host.getByRole("button", { name: "Done", exact: true }).click();
        await expect(connected(host)).toHaveAttribute("aria-label", /8 people on this board/);

        const [editor, viewer] = pages;
        await getBoardToolButton(viewer, "lucide-square-pen").click();
        await expect(viewer.getByText("The host approved this seat for viewing only.")).toBeVisible();
        await expect(viewer.locator('[data-editing="true"]')).toHaveCount(0);

        await editor.getByLabel("Upload image").setInputFiles({
            name: "shared.png", mimeType: "image/png",
            buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
        });
        await expect(editor.getByRole("img", { name: "shared.png" })).toBeVisible();
        await editor.locator(".board-scroll-layer").click({ position: { x: 100, y: 160 } });
        await Promise.all([host, ...pages.slice(1)].map((page) =>
            expect(page.getByRole("img", { name: "shared.png" })).toBeVisible({ timeout: 12_000 })));
    } finally {
        await guests.close();
    }
});

test("keeps the personal board read-only in a second tab until its writer closes", async ({ page: writer, context }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "This checks the Free storage lock once.");
    await openTestBoard(writer);
    await addMemo(writer, "First tab memo");
    await expect.poll(() => boardDatabaseContainsText(writer, "First tab memo")).toBe(true);

    const reader = await context.newPage();
    await openTestBoard(reader);
    await expect(memo(reader, "First tab memo")).toHaveCount(1);
    await getBoardToolButton(reader, "lucide-square-pen").click();
    await expect(reader.getByText("This board is open for editing in another tab.")).toBeVisible();
    await expect(reader.locator('[data-editing="true"]')).toHaveCount(0);

    await addMemo(writer, "First tab continued editing");
    await expect.poll(() => boardDatabaseContainsText(writer, "First tab continued editing")).toBe(true);
    await writer.close();
    await openTestBoard(reader);
    await expect(memo(reader, "First tab continued editing")).toHaveCount(1);
    await addMemo(reader, "Second tab became the writer");
    await expect.poll(() => boardDatabaseContainsText(reader, "Second tab became the writer")).toBe(true);
});

test("checks the browser origin behind a TLS proxy", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "This checks the signaling API once.");
    const path = "/api/peer-live/rooms";
    const forwarded = { "X-Forwarded-Host": "board.example", "X-Forwarded-Proto": "https" };
    const rejected = await request.post(path, { headers: { ...forwarded, Origin: "https://other.example" }, data: { name: "Host" } });
    expect(rejected.status()).toBe(403);

    const headers = { ...forwarded, Origin: "https://board.example" };
    const response = await request.post(path, { headers, data: { name: "Host" } });
    expect(response.ok()).toBe(true);
    const { roomId, hostToken } = await response.json() as { roomId: string; hostToken: string };
    await request.delete(`${path}/${roomId}`, { headers: { ...headers, Authorization: `Bearer ${hostToken}` } });
});

test("atomically grants only seven participant seats and revokes old invitations", async ({ request, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "This checks the signaling API once.");
    if (!baseURL) {
        throw new Error("Expected the Free server origin.");
    }
    const headers = { Origin: new URL(baseURL).origin };
    const creation = await request.post("/api/peer-live/rooms", { headers, data: { name: "Host" } });
    expect(creation.ok()).toBe(true);
    const { roomId, inviteSecret, hostToken } = await creation.json() as { roomId: string; inviteSecret: string; hostToken: string };
    const path = `/api/peer-live/rooms/${roomId}`;
    const hostHeaders = { ...headers, Authorization: `Bearer ${hostToken}` };
    const join = (index: number) => request.post(`${path}/join`, {
        headers: { ...headers, Authorization: `Bearer ${inviteSecret}` },
        data: { kind: "join", name: `Guest ${index}`, participantToken: randomBytes(32).toString("base64url") },
    });
    try {
        const attempts = await Promise.all(Array.from({ length: 8 }, (_, index) => join(index)));
        expect(attempts.filter((response) => response.ok())).toHaveLength(7);
        expect(attempts.filter((response) => response.status() === 409)).toHaveLength(1);
        const rotated = await request.patch(path, { headers: hostHeaders, data: { kind: "rotate" } });
        expect(rotated.ok()).toBe(true);
        expect((await join(9)).status()).toBe(403);
    } finally {
        await request.delete(path, { headers: hostHeaders });
    }
});

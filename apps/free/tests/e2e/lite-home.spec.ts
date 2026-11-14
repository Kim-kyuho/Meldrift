import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
    boardDatabaseContainsText,
    getBoardMenuButton,
    getBoardToolButton,
    gotoHydratedPage,
} from "./helpers";

const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
);

test.describe("Meldrift 프리 보드 첫 화면", () => {
    test.beforeEach(async ({ page }) => {
        await gotoHydratedPage(page, "/");
    });

    test("인증 컨트롤 없이 단일 보드를 바로 연다", async ({ page }) => {
        await expect(page).toHaveTitle(/^Meldrift$/i);
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        const wordmark = page.getByRole("link", { name: "Meldrift home" });
        await expect(wordmark).toBeVisible();
        await expect(wordmark.locator('img[alt=""]')).toBeVisible();
        await expect(wordmark.getByAltText("meldrift")).toBeVisible();

        await getBoardMenuButton(page).click();
        await expect(page.getByText("Free Board", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Compile to Markdown" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
        await expect(page.getByRole("button", { name: "About" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Sign-in" })).toHaveCount(0);
        await expect(page.getByLabel("Import board database")).not.toHaveAttribute("accept");
        await expect(page.getByLabel("Upload image")).toHaveAttribute(
            "accept",
            "image/jpeg,image/png,image/webp",
        );
    });

    test("새로고침 후에도 브라우저 SQLite에 로컬 이미지를 유지한다", async ({ page }) => {
        const chooserPromise = page.waitForEvent("filechooser");
        await getBoardToolButton(page, "lucide-camera").click();
        const chooser = await chooserPromise;
        await chooser.setFiles({ name: "local.png", mimeType: "image/png", buffer: onePixelPng });

        const imageCard = page.locator('[class*="image-rnd-"]').filter({ has: page.locator("img") }).first();
        await expect(imageCard).toBeVisible();
        await page.locator(".meldrift-board").click({ position: { x: 20, y: 20 } });
        await expect(imageCard).toHaveAttribute("data-editing", "false");
        await expect.poll(
            () => boardDatabaseContainsText(page, "local.png"),
            { message: "the local image to be written to the browser SQLite file" },
        ).toBe(true);

        await page.reload();
        await expect(page.locator('[class*="image-rnd-"] img').first()).toBeVisible();
    });

    test("새로고침 없이 실제 SQLite 저장 파일을 내보내고 가져온다", async ({ page }) => {
        await getBoardToolButton(page, "lucide-square-pen").click();
        await page.locator('.card-editing [contenteditable="true"]').fill("SQLite import fixture");
        await page.locator(".meldrift-board").click({ position: { x: 20, y: 20 } });
        await expect(page.locator(".card-editing")).toHaveCount(0);

        await getBoardMenuButton(page).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export" }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe("meldrift-free.sqlite");
        const savePath = await download.path();
        expect(savePath).not.toBeNull();
        const bytes = await readFile(savePath!);
        expect(bytes.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\0");
        expect(bytes.includes(Buffer.from("SQLite import fixture"))).toBe(true);

        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByRole("button", { name: "Yes", exact: true }).click();
        await expect(page.locator('[class*="memo-rnd-"]')).toHaveCount(0);

        await getBoardMenuButton(page).click();
        const chooserPromise = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import" }).click();
        const chooser = await chooserPromise;
        page.once("dialog", (dialog) => dialog.accept());
        const timeOrigin = await page.evaluate(() => performance.timeOrigin);
        await chooser.setFiles(savePath!);
        await expect(page.locator('[class*="memo-rnd-"]')).toContainText("SQLite import fixture");
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
        await expect.poll(() => boardDatabaseContainsText(page, "SQLite import fixture")).toBe(true);
        await page.reload();
        await expect(page.locator('[class*="memo-rnd-"]')).toContainText("SQLite import fixture");
    });

    test("카드 편집 중에는 내보내기를 비활성화한다", async ({ page }) => {
        await page.locator(".board-toolbar button").filter({
            has: page.locator("svg.lucide-square-pen"),
        }).click();
        await getBoardMenuButton(page).click();
        await expect(page.getByRole("button", { name: "Export" })).toBeDisabled();
        await expect(page.getByText("Finish editing before exporting.")).toBeVisible();
    });

    test("확인 후에만 새로고침 없이 초기화하고 실행 취소로 복원할 수 있다", async ({ page }) => {
        const chooserPromise = page.waitForEvent("filechooser");
        await getBoardToolButton(page, "lucide-camera").click();
        const chooser = await chooserPromise;
        await chooser.setFiles({ name: "reset-me.png", mimeType: "image/png", buffer: onePixelPng });

        const imageCard = page.locator('[class*="image-rnd-"]').filter({ has: page.locator("img") }).first();
        await expect(imageCard).toBeVisible();
        await page.locator(".meldrift-board").click({ position: { x: 20, y: 20 } });
        await expect(imageCard).toHaveAttribute("data-editing", "false");
        await expect.poll(() => boardDatabaseContainsText(page, "reset-me.png")).toBe(true);

        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(page.getByRole("heading", { name: "Reset Meldrift Free Edition?" })).toBeVisible();
        await expect(page.getByText("All cards and drawings on this board will be removed. You can undo this change until you reload the page.")).toBeVisible();
        await page.getByRole("button", { name: "No" }).click();
        await expect(imageCard).toBeVisible();

        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reset" }).click();
        const timeOrigin = await page.evaluate(() => performance.timeOrigin);
        await page.getByRole("button", { name: "Yes" }).click();

        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(page.locator('[class*="image-rnd-"]')).toHaveCount(0);
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);

        const history = page.getByRole("toolbar", { name: "Board history" });
        await history.getByRole("button", { name: "Undo board change" }).click();
        await expect(imageCard).toBeVisible();
        await history.getByRole("button", { name: "Redo board change" }).click();
        await expect(imageCard).toHaveCount(0);

        await getBoardMenuButton(page).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        await downloadPromise;
        await page.reload();
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(imageCard).toHaveCount(0);
    });
});

test.describe("Meldrift 프리 보드 도움말", () => {
    test("빈 보드에서 도움말을 열고 Ctrl·Command 도움말 단축키로 다시 연다", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator(".board-scroll-layer")).toBeVisible();

        const helpDialog = page.getByRole("dialog", { name: "Help" });
        await expect(helpDialog).toBeVisible();
        const usesCommandKey = await page.evaluate(() =>
            /Macintosh|Mac OS X|iPhone|iPad|iPod/i.test(window.navigator.userAgent)
        );
        await expect(helpDialog.getByLabel(
            usesCommandKey
                ? "Help shortcut: Command Shift P"
                : "Help shortcut: Control Shift P"
        )).toBeVisible();
        await expect(helpDialog.getByRole("heading", { name: "Welcome to Meldrift!" })).toBeVisible();
        await expect(helpDialog.getByRole("img", { name: "Meldrift help 1" })).toBeVisible();
        await expect(helpDialog.getByRole("img", { name: "Meldrift help 2" })).toBeVisible();
        await expect(helpDialog.getByRole("img", { name: "Meldrift help 3" })).toBeVisible();
        await expect(helpDialog.getByRole("button", { name: /download/i })).toHaveCount(0);

        await helpDialog.getByRole("button", { name: "Close Help" }).click();
        await expect(helpDialog).toHaveCount(0);

        await page.reload();
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(helpDialog).toBeVisible();

        await helpDialog.getByRole("button", { name: "Close Help" }).click();
        await getBoardToolButton(page, "lucide-square-pen").click();
        const editingCard = page.locator(".card-editing");
        await expect(editingCard).toBeVisible();
        await editingCard.locator('[contenteditable="true"]').fill("My first memo");
        const cardBox = (await editingCard.boundingBox())!;
        await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y - 40);
        await expect(page.locator(".card-editing")).toHaveCount(0);
        await page.waitForTimeout(600);

        await page.reload();
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(helpDialog).toHaveCount(0);

        await page.keyboard.press("Control+Shift+P");
        await expect(helpDialog).toBeVisible();

        await helpDialog.getByRole("button", { name: "Close Help" }).click();
        await page.keyboard.press("Meta+Shift+P");
        await expect(helpDialog).toBeVisible();
    });
});

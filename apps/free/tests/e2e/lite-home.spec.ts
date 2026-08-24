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

test.describe("Meldrift Free Edition home", () => {
    test.beforeEach(async ({ page }) => {
        await gotoHydratedPage(page, "/");
    });

    test("opens the single board directly without authentication controls", async ({ page }) => {
        await expect(page).toHaveTitle(/^Meldrift$/i);
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        const wordmark = page.getByRole("link", { name: "Meldrift home" });
        await expect(wordmark).toBeVisible();
        await expect(wordmark.locator('img[alt=""]')).toBeVisible();
        await expect(wordmark.getByAltText("meldrift")).toBeVisible();

        await getBoardMenuButton(page).click();
        await expect(page.getByText("Free Edition", { exact: true })).toBeVisible();
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

    test("stores a local image in browser SQLite across reloads", async ({ page }) => {
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

    test("exports and imports an actual SQLite save file", async ({ page }) => {
        await getBoardMenuButton(page).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export" }).click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toBe("meldrift-free.sqlite");
        const savePath = await download.path();
        expect(savePath).not.toBeNull();
        const bytes = await readFile(savePath!);
        expect(bytes.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\0");

        await getBoardMenuButton(page).click();
        const chooserPromise = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Import" }).click();
        const chooser = await chooserPromise;
        page.once("dialog", (dialog) => dialog.accept());
        const reloaded = page.waitForEvent("load");
        await chooser.setFiles(savePath!);
        await reloaded;
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
    });

    test("disables Export while a card is being edited", async ({ page }) => {
        await page.locator(".board-toolbar button").filter({
            has: page.locator("svg.lucide-square-pen"),
        }).click();
        await getBoardMenuButton(page).click();
        await expect(page.getByRole("button", { name: "Export" })).toBeDisabled();
        await expect(page.getByText("Finish editing before exporting.")).toBeVisible();
    });

    test("resets only after confirmation and reopens an empty board", async ({ page }) => {
        const chooserPromise = page.waitForEvent("filechooser");
        await getBoardToolButton(page, "lucide-camera").click();
        const chooser = await chooserPromise;
        await chooser.setFiles({ name: "reset-me.png", mimeType: "image/png", buffer: onePixelPng });

        const imageCard = page.locator('[class*="image-rnd-"]').filter({ has: page.locator("img") }).first();
        await expect(imageCard).toBeVisible();
        await page.locator(".meldrift-board").click({ position: { x: 20, y: 20 } });
        await expect(imageCard).toHaveAttribute("data-editing", "false");

        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reset" }).click();
        await expect(page.getByRole("heading", { name: "Reset Meldrift Free Edition?" })).toBeVisible();
        await expect(page.getByText("Once deleted, your board data cannot be recovered.")).toBeVisible();
        await page.getByRole("button", { name: "No" }).click();
        await expect(imageCard).toBeVisible();

        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Reset" }).click();
        const reloaded = page.waitForEvent("load");
        await page.getByRole("button", { name: "Yes" }).click();
        await reloaded;

        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(page.locator('[class*="image-rnd-"]')).toHaveCount(0);
    });
});

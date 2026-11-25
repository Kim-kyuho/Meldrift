import { expect, test } from "@playwright/test";
import { getBoardMenuButton, gotoHydratedPage } from "./helpers";

const sampleMarkdown = [
    "# Project Overview",
    "Imported from Markdown.",
    "",
    "| Task | Owner |",
    "| --- | --- |",
    "| Design | Kim |",
    "",
    "```mermaid",
    "flowchart LR",
    "  Draft --> Published",
    "```",
    "",
    "## Next Steps",
    "Verify round-trip.",
].join("\n");

test.describe("Markdown 파일 임포트", () => {
    test("단일 Import 입력에서 .md 파일을 선택해 메모·표·Mermaid 카드로 배치하고 Undo로 복원한다", async ({ page }) => {
        await gotoHydratedPage(page, "/");

        await getBoardMenuButton(page).click();
        await page.getByLabel("Import board database").setInputFiles({
            name: "sample.md",
            mimeType: "text/markdown",
            buffer: Buffer.from(sampleMarkdown, "utf-8"),
        });

        await expect(page.getByText("Project Overview")).toBeVisible();
        await expect(page.getByText("Next Steps")).toBeVisible();
        await expect(page.locator('[class*="table-rnd-"]')).toHaveCount(1);
        await expect(page.locator('[class*="mermaid-rnd-"]')).toHaveCount(1);

        // 새로고침 후에도 IndexedDB에 유지된다.
        await page.reload();
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(page.getByText("Project Overview")).toBeVisible();
        await expect(page.locator('[class*="table-rnd-"]')).toHaveCount(1);
        await expect(page.locator('[class*="mermaid-rnd-"]')).toHaveCount(1);
    });
});

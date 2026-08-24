import { expect, test } from "@playwright/test";
import {
    getBoardMenuButton,
    getBoardToolButton,
    openTestBoard,
} from "./helpers";

test.describe("보드 작업 화면", () => {
    test.beforeEach(async ({ page }) => {
        const boardExists = await openTestBoard(page);

        // 개발 DB에 보드가 하나도 없고 E2E_BOARD_ID도 없으면 데이터 의존 테스트만 skip한다.
        test.skip(!boardExists, "E2E 검증에 사용할 보드가 없습니다.");
    });

    test("보드 좌표 레이어를 렌더링한다", async ({ page }) => {
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await expect(page.locator(".board-size-layer")).toBeVisible();
        await expect(page.locator(".meldrift-board")).toBeVisible();
        await expect(page.locator("#card-tool-portal")).toBeAttached();
    });

    test("줌 버튼으로 확대 비율을 변경한다", async ({ page }) => {
        const zoomText = page.locator(".board-toolbar").filter({
            has: page.getByRole("button", { name: "Zoom in" }),
        }).locator("span");
        const initialZoom = await zoomText.textContent();

        await page.getByRole("button", { name: "Zoom in" }).click();

        await expect(zoomText).not.toHaveText(initialZoom ?? "");
        await expect(zoomText).toContainText("%");
    });

    test("메모 검색 패널을 열고 검색어를 입력한다", async ({ page }) => {
        await getBoardToolButton(page, "lucide-search").click();

        const searchInput = page.getByPlaceholder("Search memos");
        await expect(searchInput).toBeVisible();
        await searchInput.fill("__playwright_no_matching_memo__");
        await expect(searchInput).toHaveValue("__playwright_no_matching_memo__");
    });

    test("메모 네비게이터와 검색 패널을 번갈아 연다", async ({ page }) => {
        await page.getByRole("button", { name: "Open memo navigator" }).click();
        await expect(page.getByRole("textbox", { name: "Memo number" })).toBeVisible();

        await page.getByRole("button", { name: "Search memos" }).click();
        await expect(page.getByRole("textbox", { name: "Memo number" })).toBeHidden();
        await expect(page.getByPlaceholder("Search memos")).toBeVisible();
    });

    test("Markdown 컴파일 모달을 열고 닫는다", async ({ page }) => {
        await getBoardMenuButton(page).click();
        await page.getByRole("button", { name: "Compile to Markdown" }).click();

        const markdownView = page.getByLabel("Compiled Markdown document");
        await expect(markdownView).toBeVisible();
        await expect(page.getByRole("heading", { name: "Compiled Markdown" })).toBeVisible();

        await page.getByRole("button", { name: "Close Markdown view" }).click();
        await expect(markdownView).toBeHidden();
    });

    test("Mermaid 소스 변경을 새로고침 없이 렌더링한다", async ({ page }) => {
        await getBoardToolButton(page, "lucide-workflow").click();

        const sourceEditor = page.locator("textarea");
        await expect(sourceEditor).toBeVisible();
        await sourceEditor.fill("flowchart TD\nA[Live preview] --> B[Without reload]");

        const renderedDiagram = page.locator(".mermaid-rendered");
        await expect(renderedDiagram).toContainText("Live preview");
        await expect(renderedDiagram).toContainText("Without reload");
    });
});

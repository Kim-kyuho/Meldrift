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

        const sourceEditor = page.getByLabel("Mermaid source");
        await expect(sourceEditor).toBeVisible();
        await sourceEditor.fill("flowchart TD\nA[Live preview] --> B[Without reload]");

        const renderedDiagram = page.locator(".mermaid-card-diagram .meldrift-diagram-svg");
        await expect(renderedDiagram).toContainText("Live preview");
        await expect(renderedDiagram).toContainText("Without reload");
    });

    test("Mermaid 에디터를 데스크톱은 왼쪽에, 모바일은 화면 하단에 띄운다", async ({ page }, testInfo) => {
        await getBoardToolButton(page, "lucide-workflow").click();

        const card = page.locator('[class*="mermaid-rnd-"][data-editing="true"]');
        const panel = page.getByRole("region", { name: "Mermaid editor" });
        const palette = page.locator(".meldrift-diagram-palette");
        const isMobile = (page.viewportSize()?.width ?? 0) < 768;
        await expect(card.locator(".meldrift-diagram-svg g.node")).toHaveCount(2);
        await expect(card).toHaveCSS("height", "180px");

        if (isMobile) {
            await expect(panel.getByRole("button", { name: "Minimize mermaid editor" })).toHaveCount(0);
            await expect(panel.getByLabel("Mermaid source")).toBeVisible();
            const panelBox = (await panel.boundingBox())!;
            const viewport = page.viewportSize()!;
            expect(panelBox.height).toBeLessThanOrEqual(viewport.height * 0.45 + 1);
            expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height - 80);
            expect(panelBox.x).toBe(16);
            await expect(card.getByRole("region", { name: "Mermaid editor" })).toHaveCount(0);
            await expect(card.locator(".mermaid-card-diagram").getByLabel("Mermaid source")).toHaveCount(0);
            await expect(palette).toHaveCount(0);
            const checkTools = async () => {
                const editorBox = (await panel.boundingBox())!;
                for (const label of ["Bring Mermaid to front", "Send Mermaid to back", "Delete Mermaid", "Zoom in", "Zoom out"]) {
                    const button = page.getByRole("button", { name: label, exact: true });
                    const box = (await button.boundingBox())!;
                    expect(editorBox.x + editorBox.width <= box.x || editorBox.y + editorBox.height <= box.y).toBe(true);
                    await button.click({ trial: true });
                }
            };
            await checkTools();
            await page.screenshot({ path: testInfo.outputPath("mermaid-editor-mobile.png") });
            await page.setViewportSize({ width: 320, height: 568 });
            await checkTools();
            await page.screenshot({ path: testInfo.outputPath("mermaid-editor-narrow-mobile.png") });
            return;
        }

        await expect(panel.getByLabel("Mermaid source")).toBeVisible();
        await expect(card.getByLabel("Mermaid source")).toHaveCount(0);
        await expect(panel.locator(".meldrift-diagram-palette")).toBeVisible();

        const shapes = card.locator(".meldrift-diagram-svg g.node");
        await expect(shapes).not.toHaveCount(0);
        const shapeCount = await shapes.count();
        await panel.locator(".meldrift-diagram-shape:not(:disabled)").first().click();
        await expect(shapes).toHaveCount(shapeCount + 1);
        const sourceBefore = await panel.getByLabel("Mermaid source").innerText();
        await panel.getByRole("button", { name: "Minimize mermaid editor" }).click();
        await expect(panel.getByRole("heading", { name: "Mermaid Editor" })).toBeVisible();
        await expect(panel.getByLabel("Mermaid source")).toBeHidden();
        await expect(panel.locator(".meldrift-diagram-palette")).toBeHidden();
        await expect(card).toHaveAttribute("data-editing", "true");
        const minimized = (await panel.boundingBox())!;
        const titleBar = (await panel.locator("header").boundingBox())!;
        expect(Math.abs(minimized.height - titleBar.height)).toBeLessThan(1);
        await page.screenshot({ path: testInfo.outputPath("mermaid-editor-minimized.png") });
        await panel.getByRole("button", { name: "Expand mermaid editor" }).click();
        await expect(panel.getByLabel("Mermaid source")).toBeVisible();
        await expect(panel.locator(".meldrift-diagram-palette")).toBeVisible();
        await expect(panel.getByLabel("Mermaid source")).toHaveText(sourceBefore);
        await expect(shapes).toHaveCount(shapeCount + 1);
        await page.screenshot({ path: testInfo.outputPath("mermaid-editor-expanded.png") });
    });

    test("Mermaid 노드를 놓으면 카드가 그림에 맞춰 커지고 줄어든다", async ({ page }) => {
        await getBoardToolButton(page, "lucide-workflow").click();

        const card = page.locator('[class*="mermaid-rnd-"][data-editing="true"]');
        const nodes = card.locator(".mermaid-card-diagram g.node");
        await expect(nodes).toHaveCount(2);
        const nodeBox = (index: number) => nodes.nth(index).evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });

        const cardBefore = (await card.boundingBox())!;
        const start = await nodeBox(0);
        const end = await nodeBox(1);
        await nodes.nth(1).click();
        const from = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
        const to = { x: cardBefore.x + cardBefore.width + 80, y: from.y };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 10 });
        await page.mouse.up();

        await expect.poll(async () => (await card.boundingBox())!.width).toBeGreaterThan(cardBefore.width + 60);
        const cardAfter = (await card.boundingBox())!;
        expect(cardAfter.x).toBeCloseTo(cardBefore.x, 0);
        expect(cardAfter.width).toBeGreaterThan(cardBefore.width + 60);
        const startAfter = await nodeBox(0);
        expect(Math.abs(startAfter.x - start.x)).toBeLessThan(2);
        expect(Math.abs(startAfter.width - start.width)).toBeLessThan(2);
        const endAfter = await nodeBox(1);
        expect(Math.abs(endAfter.x + endAfter.width / 2 - to.x)).toBeLessThan(2);
        await expect(page.getByLabel("Mermaid source")).toContainText("meldrift-layout");
        const backFrom = { x: endAfter.x + endAfter.width / 2, y: endAfter.y + endAfter.height / 2 };
        await page.mouse.move(backFrom.x, backFrom.y);
        await page.mouse.down();
        await page.mouse.move(from.x, from.y, { steps: 10 });
        await page.mouse.up();
        await expect.poll(async () => (await card.boundingBox())!.width).toBeLessThan(cardAfter.width - 40);
        const startRestored = await nodeBox(0);
        expect(Math.abs(startRestored.width - start.width)).toBeLessThan(2);
    });

    test("Mermaid 선택 영역과 핸들은 보드 줌 변경을 따른다", async ({ page }) => {
        await getBoardToolButton(page, "lucide-workflow").click();
        const card = page.locator('[class*="mermaid-rnd-"][data-editing="true"]');
        const nodes = card.locator(".mermaid-card-diagram g.node");
        await expect(nodes).toHaveCount(2);
        await nodes.nth(1).click();

        const checkAlignment = async () => {
            await expect.poll(() => card.evaluate((element) => {
                const node = element.querySelectorAll(".mermaid-card-diagram g.node")[1].getBoundingClientRect();
                const selection = element.querySelector<HTMLElement>(".meldrift-diagram-selection:not([hidden])")?.getBoundingClientRect();
                const handle = element.querySelector<HTMLElement>('.meldrift-diagram-handle:not(.meldrift-diagram-target-handle)[data-side="right"]')?.getBoundingClientRect();
                if (!selection || !handle) {
                    return Infinity;
                }
                return Math.max(
                    Math.abs(selection.x + selection.width / 2 - node.x - node.width / 2),
                    Math.abs(selection.y + selection.height / 2 - node.y - node.height / 2),
                    Math.abs(handle.x + handle.width / 2 - node.right),
                    Math.abs(handle.y + handle.height / 2 - node.y - node.height / 2),
                );
            })).toBeLessThan(2);
        };
        await checkAlignment();
        for (const [name, steps] of [["Zoom out", 5], ["Zoom in", 15]] as const) {
            for (let step = 0; step < steps; step++) {
                await page.getByRole("button", { name, exact: true }).click();
            }
            await checkAlignment();
        }
    });

    test("Mermaid 소스는 카드 크기를 맞추고 Rnd 리사이즈는 노드 배율만 바꾼다", async ({ page }) => {
        await getBoardToolButton(page, "lucide-workflow").click();
        const card = page.locator('[class*="mermaid-rnd-"][data-editing="true"]');
        const editor = page.getByLabel("Mermaid source");
        await expect(card.locator("g.node")).toHaveCount(2);
        const initial = (await card.boundingBox())!;
        await editor.fill('flowchart TD\nA[Start] --> B[Second]\nB --> C[Third]\nC --> D[Fourth]');
        await expect(card.locator("g.node")).toHaveCount(4);
        await expect.poll(async () => (await card.boundingBox())!.height).toBeGreaterThan(initial.height + 50);
        await editor.fill('flowchart LR\nA[Start] --> B[End]');
        await expect(card.locator("g.node")).toHaveCount(2);
        await expect.poll(async () => (await card.boundingBox())!.height).toBeLessThan(initial.height + 10);
        await editor.press("Escape");
        await editor.blur();

        if ((page.viewportSize()?.width ?? 0) < 768) {
            const panel = (await page.getByRole("region", { name: "Mermaid editor" }).boundingBox())!;
            const bounds = (await card.boundingBox())!;
            const scrollBy = Math.max(0, bounds.y + bounds.height + 60 - panel.y);
            await page.locator(".board-scroll-layer").evaluate((element, distance) => {
                element.scrollTop += distance;
            }, scrollBy);
        }

        const resizeHandle = card.locator('div[style*="cursor: se-resize"]').last();
        await resizeHandle.hover();
        const before = (await card.boundingBox())!;
        const node = card.locator("g.node").first();
        const nodeBefore = (await node.boundingBox())!;
        const resize = (await resizeHandle.boundingBox())!;
        await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
        await page.mouse.down();
        await page.mouse.move(resize.x + resize.width / 2 + 40, resize.y + resize.height / 2 + 40, { steps: 10 });
        await page.mouse.up();
        await expect.poll(async () => (await node.boundingBox())!.width).toBeGreaterThan(nodeBefore.width + 5);
        const resized = (await card.boundingBox())!;
        expect(resized.width).toBeGreaterThan(before.width + 20);
        const savedWidth = await card.evaluate((element: HTMLElement) => element.style.width);
        await page.getByRole("button", { name: "Close mermaid editor" }).click();
        await expect(page.locator(".card-editing")).toHaveCount(0);
        await getBoardMenuButton(page).click();
        const downloaded = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        await downloaded;
        await page.reload();
        const restored = page.locator('[class*="mermaid-rnd-"]');
        await expect(restored.locator("g.node")).toHaveCount(2);
        await expect(restored).toHaveCSS("width", savedWidth);
    });
});

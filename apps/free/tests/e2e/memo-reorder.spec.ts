import { expect, Page, test } from "@playwright/test";
import { getBoardMenuButton, getBoardToolButton, openTestBoard } from "./helpers";

// 메모 순서는 브라우저 SQLite에 남는 값이라, 화면에서 바꾼 순서가 새로고침 뒤에도 같은지까지 본다.

async function createMemo(page: Page, text: string) {
    await getBoardToolButton(page, "lucide-square-pen").click();

    const editingCard = page.locator(".card-editing");
    await expect(editingCard).toBeVisible();
    await editingCard.locator('[contenteditable="true"]').click();
    await page.keyboard.type(text);

    // 보드 빈 곳에서 시작하고 끝난 포인터 입력만 저장으로 인정한다. 카드는 화면 중앙에 생기므로
    // 바로 위쪽이 어느 화면 크기에서나 비어 있다.
    const cardBox = (await editingCard.boundingBox())!;
    await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y - 40);
    await expect(page.locator(".card-editing")).toHaveCount(0);
}

// 끄는 동안 일부러 패널 바깥까지 크게 벗어난다. 이동과 종료를 window에서 듣지 않으면
// 손잡이를 벗어나는 순간 끌기가 멈춘다.
async function dragRow(page: Page, fromIndex: number, toIndex: number) {
    const rows = page.locator(".memo-order-row");
    const handle = (await rows.nth(fromIndex).getByRole("button", { name: /^Move memo/ }).boundingBox())!;
    const to = (await rows.nth(toIndex).boundingBox())!;
    const grabX = handle.x + handle.width / 2;
    const grabY = handle.y + handle.height / 2;

    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(grabX + 400, grabY, { steps: 8 });
    await page.mouse.move(grabX + 400, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
}

async function openReorderPanel(page: Page) {
    await getBoardMenuButton(page).click();
    await page.getByRole("button", { name: "Reorder Memos" }).click();
    await expect(page.getByRole("heading", { name: "Memo Order" })).toBeVisible();
}

test.describe("메모 순서 변경", () => {
    test.beforeEach(async ({ page }) => {
        const boardExists = await openTestBoard(page);
        test.skip(!boardExists, "E2E 검증에 사용할 보드가 없습니다.");
    });

    test("보드 메뉴에서 순서 패널을 열고 닫는다", async ({ page }) => {
        await openReorderPanel(page);
        await expect(page.getByText("No memos exist.")).toBeVisible();

        await page.getByRole("button", { name: "Close memo order" }).click();
        await expect(page.getByRole("heading", { name: "Memo Order" })).toBeHidden();
    });

    test("드래그로 바꾼 순서가 새로고침 뒤에도 남는다", async ({ page }) => {
        await createMemo(page, "Alpha");
        await createMemo(page, "Beta");
        await createMemo(page, "Gamma");

        await openReorderPanel(page);
        const rows = page.locator(".memo-order-row");
        await expect(rows).toHaveText([/Alpha/, /Beta/, /Gamma/]);

        await dragRow(page, 2, 0);

        await expect(rows).toHaveText([/Gamma/, /Alpha/, /Beta/]);

        // 보드 저장은 150ms 디바운스 뒤에 일어난다. 저장 전에 새로고침하면 아무 것도 검증하지 못한다.
        await page.waitForTimeout(600);
        await page.reload();
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        await openReorderPanel(page);
        await expect(page.locator(".memo-order-row")).toHaveText([/Gamma/, /Alpha/, /Beta/]);
    });

    test("보드 탐색 연번이 바뀐 순서를 따른다", async ({ page }) => {
        await createMemo(page, "Alpha");
        await createMemo(page, "Beta");

        await openReorderPanel(page);
        const rows = page.locator(".memo-order-row");
        await dragRow(page, 1, 0);
        await expect(rows).toHaveText([/Beta/, /Alpha/]);

        await page.getByRole("button", { name: "Open memo navigator" }).click();
        await page.getByRole("textbox", { name: "Memo number" }).fill("1");

        await expect(page.locator(".memo-focused")).toContainText("Beta");
    });

    test("검색 결과도 바뀐 순서대로 돈다", async ({ page }) => {
        await createMemo(page, "shared alpha");
        await createMemo(page, "shared beta");

        await openReorderPanel(page);
        await dragRow(page, 1, 0);
        await expect(page.locator(".memo-order-row")).toHaveText([/shared beta/, /shared alpha/]);

        await page.getByRole("button", { name: "Search memos" }).click();
        await page.getByPlaceholder("Search memos").fill("shared");

        await expect(page.locator(".memo-focused")).toContainText("shared beta");
    });
});

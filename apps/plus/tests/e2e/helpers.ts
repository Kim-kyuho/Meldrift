import { expect, Page } from "@playwright/test";

// Meldrift의 client hydration이 끝나면 useBoardAuth가 /api/me를 요청한다.
// 화면이 보인다는 조건만으로는 React event handler가 연결됐다고 보장할 수 없으므로
// 사용자 입력이 있는 테스트는 이 응답까지 기다린다.
export async function gotoHydratedPage(page: Page, path: string) {
    const currentUserResponse = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url());
        return responseUrl.pathname === "/api/me" && response.request().method() === "GET";
    });

    await page.goto(path);
    await currentUserResponse;
}

// 테스트 전용 보드 ID가 있으면 그것을 사용하고, 없으면 목록의 첫 번째 보드로 이동한다.
// CI에서 고정 fixture 보드를 사용할 때는 E2E_BOARD_ID를 지정한다.
export async function openTestBoard(page: Page) {
    const configuredBoardId = process.env.E2E_BOARD_ID;

    if (configuredBoardId) {
        await gotoHydratedPage(page, `/boards/${configuredBoardId}`);
        await expect(page.locator(".board-scroll-layer")).toBeVisible();
        return true;
    }

    await gotoHydratedPage(page, "/");
    const firstBoardLink = page.locator('a[href^="/boards/"]').first();

    if (await firstBoardLink.count() === 0) {
        if (process.env.CI) {
            throw new Error("E2E verification requires at least one board or E2E_BOARD_ID.");
        }

        return false;
    }

    const currentUserResponse = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url());
        return responseUrl.pathname === "/api/me" && response.request().method() === "GET";
    });

    await firstBoardLink.click();
    await currentUserResponse;
    await expect(page.locator(".board-scroll-layer")).toBeVisible();
    return true;
}

// BoardMenu의 Ellipsis 버튼에는 현재 accessible name이 없으므로 SVG 클래스 기준으로 찾는다.
// 추후 aria-label을 추가하면 getByRole 기반 locator로 교체하는 것이 더 안정적이다.
export function getBoardMenuButton(page: Page) {
    return page.locator("button.fixed.right-5.top-5").first();
}

// BoardToolBar 아이콘 버튼도 현재 이름이 없으므로 아이콘 클래스로 찾는다.
export function getBoardToolButton(page: Page, iconClassName: string) {
    return page.locator(".board-toolbar button").filter({
        has: page.locator(`svg.${iconClassName}`),
    }).first();
}

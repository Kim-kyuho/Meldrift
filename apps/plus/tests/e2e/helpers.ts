import { expect, Page } from "@playwright/test";

// Meldrift의 client hydration이 끝나면 useBoardAuth가 /api/me를 요청한다.
// 화면이 보인다는 조건만으로는 React event handler가 연결됐다고 보장할 수 없으므로
// 사용자 입력이 있는 테스트는 이 응답까지 기다린다.
async function navigateAndWaitForUser(page: Page, navigate: () => Promise<unknown>) {
    const [response] = await Promise.all([
        // 첫 컴파일을 포함한 화면 이동은 actionTimeout 대신 테스트 전체 제한 시간 안에서 기다린다.
        page.waitForResponse((response) => {
            const responseUrl = new URL(response.url());
            return responseUrl.pathname === "/api/me" && response.request().method() === "GET";
        }, { timeout: 0 }),
        navigate(),
    ]);

    expect(response.ok(), `/api/me returned ${response.status()}`).toBe(true);
    expect(await response.json()).toHaveProperty("user");
}

export async function gotoHydratedPage(page: Page, path: string) {
    const plusPath = path === "/" ? "/plus" : `/plus${path}`;
    if (path === "/") {
        await page.goto(plusPath);
        const menu = getBoardMenuButton(page);
        const authAction = page.getByRole("button", { name: /^Sign-(in|out)$/ });
        await expect.poll(async () => {
            if (!await authAction.isVisible()) {
                await menu.click();
            }
            return authAction.isVisible();
        }).toBe(true);
        await menu.click();
        return;
    }
    await navigateAndWaitForUser(page, () => page.goto(plusPath));
}

// 이 브라우저에서 처음 여는 빈 보드는 Help가 자동으로 뜬다. Help를 다루지 않는 테스트는 닫고 시작한다.
export async function closeFirstEntryHelp(page: Page) {
    const help = page.getByRole("dialog", { name: "Help" });
    if (await help.count() === 0) {
        return;
    }
    await help.getByRole("button", { name: "Close Help" }).click();
    await page.getByRole("button", { name: "Close (Esc)" }).click();
}

// 보드 화면이 뜨기까지 dev 서버의 첫 컴파일, SQLite 워커 부팅, delta 보드의 상태·자산 내려받기가
// 차례로 들어간다. 기본 expect 타임아웃(5초)으로는 모자란다.
const boardOpenTimeoutMs = 20000;

// 테스트 전용 보드 ID가 있으면 그것을 사용하고, 없으면 목록의 첫 번째 보드로 이동한다.
// CI에서 고정 fixture 보드를 사용할 때는 E2E_BOARD_ID를 지정한다.
export async function openTestBoard(page: Page) {
    const configuredBoardId = process.env.E2E_BOARD_ID;

    if (configuredBoardId) {
        await gotoHydratedPage(page, `/boards/${configuredBoardId}`);
        await expect(page.locator(".board-scroll-layer")).toBeVisible({ timeout: boardOpenTimeoutMs });
        await closeFirstEntryHelp(page);
        return true;
    }

    await gotoHydratedPage(page, "/");
    const firstBoardLink = page.locator('a[href^="/plus/boards/"]').first();

    if (await firstBoardLink.count() === 0) {
        if (process.env.CI) {
            throw new Error("E2E verification requires at least one board or E2E_BOARD_ID.");
        }

        return false;
    }

    await navigateAndWaitForUser(page, () => firstBoardLink.click());
    await expect(page.locator(".board-scroll-layer")).toBeVisible({ timeout: boardOpenTimeoutMs });
    await closeFirstEntryHelp(page);
    return true;
}

export function getBoardMenuButton(page: Page) {
    return page.getByRole("button", { name: "Open board menu" });
}

// BoardToolBar 아이콘 버튼도 현재 이름이 없으므로 아이콘 클래스로 찾는다.
export function getBoardToolButton(page: Page, iconClassName: string) {
    return page.locator(".board-toolbar button").filter({
        has: page.locator(`svg.${iconClassName}`),
    }).first();
}

import { expect, Page } from "@playwright/test";

// playwright.config.ts가 개발 서버에 넣어 주는 어시스턴트 비밀번호.
// 잠금 해제 흐름을 검사하려면 서버와 테스트가 같은 값을 알아야 한다.
export const aiTestPassword = "e2e-assistant-password";

export async function gotoHydratedPage(page: Page, path: string) {
    await page.goto(path);
    await expect(page.locator(".board-scroll-layer")).toBeVisible();
}

export async function openTestBoard(page: Page) {
    await gotoHydratedPage(page, "/");
    return true;
}

export function getBoardMenuButton(page: Page) {
    return page.getByRole("button", { name: "Open board menu" });
}

export function getBoardToolButton(page: Page, iconClassName: string) {
    return page.locator(".board-toolbar button").filter({
        has: page.locator(`svg.${iconClassName}`),
    }).first();
}

export function boardDatabaseContainsText(page: Page, text: string) {
    return page.evaluate(async (expectedText) => {
        const databaseBytes = await new Promise<Uint8Array>((resolve, reject) => {
            const openRequest = indexedDB.open("kyuboard-lite");
            openRequest.onerror = () => reject(openRequest.error ?? new Error("IndexedDB could not be opened."));
            openRequest.onsuccess = () => {
                const storage = openRequest.result;
                try {
                    const getRequest = storage.transaction("files", "readonly").objectStore("files").get("database");
                    getRequest.onerror = () => {
                        storage.close();
                        reject(getRequest.error ?? new Error("The browser SQLite file could not be read."));
                    };
                    getRequest.onsuccess = () => {
                        storage.close();
                        const value = getRequest.result;
                        if (value instanceof ArrayBuffer) {
                            resolve(new Uint8Array(value));
                            return;
                        }
                        if (value instanceof Uint8Array) {
                            resolve(value);
                            return;
                        }
                        reject(new Error("The browser SQLite file is missing."));
                    };
                } catch (error) {
                    storage.close();
                    reject(error);
                }
            };
        });
        const expectedBytes = new TextEncoder().encode(expectedText);

        for (let offset = 0; offset <= databaseBytes.length - expectedBytes.length; offset += 1) {
            let matches = true;
            for (let index = 0; index < expectedBytes.length; index += 1) {
                if (databaseBytes[offset + index] !== expectedBytes[index]) {
                    matches = false;
                    break;
                }
            }
            if (matches) return true;
        }
        return false;
    }, text);
}

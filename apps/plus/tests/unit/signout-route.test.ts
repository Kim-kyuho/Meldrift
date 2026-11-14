import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/signout/route";
import { createSessionToken, hashSessionToken, sessionCookieName } from "@/lib/auth/session";

const mocks = vi.hoisted(() => ({
    getDb: vi.fn(),
    eq: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("drizzle-orm", async (importOriginal) => ({
    ...await importOriginal<typeof import("drizzle-orm")>(),
    eq: mocks.eq,
}));

function createSignOutRequest(token?: string) {
    return new NextRequest("http://localhost/api/signout", {
        method: "POST",
        headers: token ? { cookie: `${sessionCookieName}=${token}` } : undefined,
    });
}

describe("로그아웃 API: POST /api/signout", () => {
    beforeEach(() => {
        mocks.eq.mockImplementation((column, value) => ({ column, value }));
        mocks.updateWhere.mockResolvedValue(undefined);
        mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
        mocks.getDb.mockReturnValue({
            update: vi.fn(() => ({ set: mocks.updateSet })),
        });
    });

    it("일치하는 데이터베이스 세션과 브라우저 쿠키를 지운다", async () => {
        const token = createSessionToken();
        const response = await POST(createSignOutRequest(token));

        expect(response.status).toBe(200);
        expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
            sessionTokenHash: null,
            sessionExpiresAt: null,
        }));
        expect(mocks.updateWhere).toHaveBeenCalledOnce();
        expect(mocks.eq.mock.calls[0][1]).toBe(hashSessionToken(token));
        expect(response.headers.get("set-cookie")).toContain(`${sessionCookieName}=`);
        expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    });

    it("토큰이 없으면 데이터베이스 조회 없이 브라우저 쿠키를 삭제한다", async () => {
        const response = await POST(createSignOutRequest());

        expect(response.status).toBe(200);
        expect(mocks.getDb).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    });
});

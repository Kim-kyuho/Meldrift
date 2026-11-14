import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/signin/route";
import { hashSessionToken, sessionCookieName, sessionMaxAgeSeconds } from "@/lib/auth/session";

const mocks = vi.hoisted(() => ({
    getDb: vi.fn(),
    verifyPassword: vi.fn(),
    selectLimit: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: mocks.verifyPassword }));

const user = {
    id: 7,
    email: "kyu@example.com",
    passwordHash: "stored-password-hash",
    isApproved: true,
    role: "admin",
};

function createSignInRequest() {
    return new NextRequest("http://localhost/api/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: user.email, password: "password123" }),
    });
}

describe("로그인 API: POST /api/signin", () => {
    beforeEach(() => {
        mocks.selectLimit.mockResolvedValue([user]);
        mocks.updateWhere.mockResolvedValue(undefined);
        mocks.verifyPassword.mockResolvedValue(true);
        mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
        mocks.getDb.mockReturnValue({
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({ limit: mocks.selectLimit })),
                })),
            })),
            update: vi.fn(() => ({ set: mocks.updateSet })),
        });
    });

    it("쿠키 설정 전에 토큰 해시와 일치하는 만료 시각을 저장한다", async () => {
        const now = Date.now();
        const response = await POST(createSignInRequest());
        const cookie = response.cookies.get(sessionCookieName);

        expect(response.status).toBe(200);
        expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.maxAge).toBe(sessionMaxAgeSeconds);
        expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
            sessionTokenHash: hashSessionToken(cookie!.value),
            sessionExpiresAt: expect.any(Date),
        }));

        const update = mocks.updateSet.mock.calls[0][0];
        expect(update.sessionExpiresAt.getTime()).toBeGreaterThanOrEqual(
            now + sessionMaxAgeSeconds * 1000,
        );
    });

    it("로그인할 때마다 다른 토큰으로 저장된 해시를 교체한다", async () => {
        const firstResponse = await POST(createSignInRequest());
        const secondResponse = await POST(createSignInRequest());
        const firstToken = firstResponse.cookies.get(sessionCookieName)!.value;
        const secondToken = secondResponse.cookies.get(sessionCookieName)!.value;

        expect(firstToken).not.toBe(secondToken);
        expect(mocks.updateSet.mock.calls[0][0].sessionTokenHash).toBe(hashSessionToken(firstToken));
        expect(mocks.updateSet.mock.calls[1][0].sessionTokenHash).toBe(hashSessionToken(secondToken));
        expect(mocks.updateSet.mock.calls[1][0].sessionTokenHash).not.toBe(
            mocks.updateSet.mock.calls[0][0].sessionTokenHash,
        );
    });
});

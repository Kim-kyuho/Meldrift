import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { createSessionToken, hashSessionToken, sessionCookieName } from "@/lib/auth/session";

const mocks = vi.hoisted(() => ({
    getDb: vi.fn(),
    and: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    selectLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("drizzle-orm", async (importOriginal) => ({
    ...await importOriginal<typeof import("drizzle-orm")>(),
    and: mocks.and,
    eq: mocks.eq,
    gt: mocks.gt,
}));

function createAuthenticatedRequest(token: string) {
    return new NextRequest("http://localhost/api/me", {
        headers: { cookie: `${sessionCookieName}=${token}` },
    });
}

describe("getCurrentUserFromRequest", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-21T00:00:00.000Z"));
        mocks.eq.mockImplementation((column, value) => ({ column, value }));
        mocks.gt.mockImplementation((column, value) => ({ column, value }));
        mocks.and.mockImplementation((...conditions) => ({ conditions }));
        mocks.getDb.mockReturnValue({
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({ limit: mocks.selectLimit })),
                })),
            })),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns the user for a matching unexpired session", async () => {
        const token = createSessionToken();
        mocks.selectLimit.mockResolvedValue([{
            id: 7,
            email: "kyu@example.com",
            isApproved: true,
            role: "admin",
        }]);

        await expect(getCurrentUserFromRequest(createAuthenticatedRequest(token)))
            .resolves.toEqual({
                id: 7,
                email: "kyu@example.com",
                isApproved: true,
                role: "admin",
            });
        expect(mocks.eq.mock.calls[0][1]).toBe(hashSessionToken(token));
    });

    it("queries only sessions whose expiration is later than the current time", async () => {
        mocks.selectLimit.mockResolvedValue([]);

        await expect(getCurrentUserFromRequest(createAuthenticatedRequest(createSessionToken())))
            .resolves.toBeNull();
        expect(mocks.gt).toHaveBeenCalledOnce();
        expect(mocks.gt.mock.calls[0][1]).toEqual(new Date("2026-08-21T00:00:00.000Z"));
        expect(mocks.and).toHaveBeenCalledWith(
            mocks.eq.mock.results[0].value,
            mocks.gt.mock.results[0].value,
        );
    });

    it("rejects a token that does not match a stored session", async () => {
        mocks.selectLimit.mockResolvedValue([]);

        await expect(getCurrentUserFromRequest(createAuthenticatedRequest(createSessionToken())))
            .resolves.toBeNull();
    });

    it("rejects malformed tokens without querying the database", async () => {
        await expect(getCurrentUserFromRequest(createAuthenticatedRequest("invalid")))
            .resolves.toBeNull();
        expect(mocks.getDb).not.toHaveBeenCalled();
    });
});

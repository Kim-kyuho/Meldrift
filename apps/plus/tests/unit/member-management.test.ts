import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { GET, PATCH, DELETE } from "@/app/api/members/route";
import { BoardPrivacyError } from "@/lib/board-privacy";

const mocks = vi.hoisted(() => ({ user: vi.fn(), select: vi.fn(), batch: vi.fn(), execute: vi.fn(), privacy: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user }));
vi.mock("@/lib/board-privacy", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/lib/board-privacy")>(),
    prepareBoardPrivacy: mocks.privacy,
}));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    select: mocks.select, batch: mocks.batch, execute: mocks.execute,
}) }));

const admin = { id: 4, email: "admin@example.com", role: "admin", isApproved: false };
const request = (method = "GET", body?: object) => new NextRequest("http://localhost/api/members", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
});

describe("Plus member management", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.mockResolvedValue(admin);
    });

    it("rejects signed-out and non-admin API access before querying memberships", async () => {
        mocks.user.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...admin, role: "user", isApproved: true });
        expect((await GET(request())).status).toBe(401);
        expect((await GET(request())).status).toBe(403);
        expect(mocks.select).not.toHaveBeenCalled();
    });

    it("rejects a bulk selection containing the acting administrator and blocks self-demotion", async () => {
        expect((await DELETE(request("DELETE", { ids: [4, 5] }))).status).toBe(409);
        expect((await PATCH(request("PATCH", { id: 4, role: "user", isApproved: true }))).status).toBe(409);
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("guards a bulk deletion and retains the selected members' boards as private in the same statement", async () => {
        mocks.select
            .mockReturnValueOnce({ from: () => ({ where: async () => [{ email: "member@example.com" }] }) })
            .mockReturnValueOnce({ from: () => ({ where: async () => [{ boardId: 9, previewVersion: null }] }) });
        mocks.batch.mockResolvedValue([{}, { rows: [{ deleted: 1, retained: 1 }] }]);
        const response = await DELETE(request("DELETE", { ids: [5] }));
        expect(await response.json()).toEqual({ ok: true, retainedBoards: 1 });
        expect(mocks.privacy).toHaveBeenCalledWith(9, false);
        const statement = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]).sql;
        expect(statement).toContain("UPDATE boards SET private_flg = 1");
        expect(statement).toContain("DELETE FROM users");
        expect(statement).toContain("session_expires_at > now()");
        expect(statement).toContain("(SELECT count(*) FROM targets)");
    });

    it("keeps member accounts when the retained board's public images could not be revoked", async () => {
        mocks.select
            .mockReturnValueOnce({ from: () => ({ where: async () => [{ email: "member@example.com" }] }) })
            .mockReturnValueOnce({ from: () => ({ where: async () => [{ boardId: 9, previewVersion: null }] }) });
        mocks.privacy.mockRejectedValueOnce(new BoardPrivacyError("Cloudinary unavailable"));

        const response = await DELETE(request("DELETE", { ids: [5] }));
        expect(response.status).toBe(503);
        expect(mocks.batch).not.toHaveBeenCalled();
    });
});

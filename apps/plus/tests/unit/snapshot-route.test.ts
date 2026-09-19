import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { GET, PUT } from "@/app/api/boards/[boardId]/snapshot/route";

const mocks = vi.hoisted(() => ({
    user: vi.fn(), permission: vi.fn(), execute: vi.fn(), limit: vi.fn(), decode: vi.fn(), legacy: vi.fn(),
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user, getCardPermissionMessage: mocks.permission }));
vi.mock("@/lib/auth/session", () => ({ getSessionTokenHash: () => "current-session", sessionCookieName: "session" }));
vi.mock("@/lib/snapshot-codec", () => ({ decodeSnapshot: mocks.decode }));
vi.mock("@/lib/board-state-store", () => ({ loadBoardState: mocks.legacy }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    execute: mocks.execute,
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
}) }));

const context = { params: Promise.resolve({ boardId: "7" }) };
function request(headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost/api/boards/7/snapshot", { method: "PUT", body: new Uint8Array(16), headers: {
        "X-Snapshot-Revision": "2", "X-Snapshot-Mutation": "change-3",
        ...headers,
    } });
}

describe("snapshot API", () => {
    beforeEach(() => {
        mocks.user.mockResolvedValue({ id: 5, isApproved: true });
        mocks.permission.mockReturnValue(null);
        mocks.execute.mockResolvedValue({ rows: [{ revision: 3 }] });
        mocks.decode.mockResolvedValue({});
        mocks.limit.mockResolvedValue([{ boardId: 7 }]);
    });

    it("rejects unauthenticated writes before reading the body", async () => {
        mocks.user.mockResolvedValue(null);
        expect((await PUT(request(), context)).status).toBe(403);
        expect(mocks.decode).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it.each([["X-Snapshot-Revision", "-1"], ["X-Snapshot-Mutation", ""]])("rejects invalid write metadata", async (name, value) => {
        expect((await PUT(request({ [name]: value }), context)).status).toBe(400);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("requires an explicit base revision", async () => {
        const input = request();
        input.headers.delete("X-Snapshot-Revision");
        expect((await PUT(input, context)).status).toBe(400);
    });

    it("rejects oversized bodies before decoding SQLite", async () => {
        expect((await PUT(request({ "Content-Length": String(4 * 1024 * 1024 + 1) }), context)).status).toBe(413);
        expect(mocks.decode).not.toHaveBeenCalled();
    });

    it("rejects corrupt or cross-board snapshots", async () => {
        mocks.decode.mockRejectedValueOnce(new Error("Snapshot contains another board."));
        expect((await PUT(request(), context)).status).toBe(400);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("checks revision and the live session in the atomic write", async () => {
        const response = await PUT(request(), context);
        expect(await response.json()).toEqual({ ok: true, revision: 3 });
        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
        expect(query.sql).toContain("FOR UPDATE");
        expect(query.sql).toContain("u.session_expires_at > now()");
        expect(query.sql).toContain("WHERE board_snapshots.revision =");
        expect(query.sql).toContain("OR board_snapshots.mutation_id = excluded.mutation_id");
        expect(query.params).toContain("current-session");
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it("returns a conflict instead of accepting a stale write", async () => {
        mocks.execute.mockResolvedValue({ rows: [] });
        expect((await PUT(request(), context)).status).toBe(409);
    });

    it("returns 404 rather than reviving a deleted board", async () => {
        mocks.limit.mockResolvedValue([]);
        expect((await GET(request(), context)).status).toBe(404);
        expect(mocks.legacy).not.toHaveBeenCalled();
    });

    it("returns binary bytes and the committed revision without cache", async () => {
        mocks.limit
            .mockResolvedValueOnce([{ boardId: 7 }])
            .mockResolvedValueOnce([{ boardId: 7, mode: "snapshot", revision: 4 }])
            .mockResolvedValueOnce([{ snapshot: Buffer.from([1, 2, 3]), revision: 4, mutationId: "change-4" }]);
        const response = await GET(request(), context);
        expect(response.headers.get("X-Snapshot-Revision")).toBe("4");
        expect(response.headers.get("X-Storage-Mode")).toBe("snapshot");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("loads legacy cards only before the first snapshot", async () => {
        mocks.limit
            .mockResolvedValueOnce([{ boardId: 7 }])
            .mockResolvedValueOnce([{ boardId: 7, mode: "snapshot", revision: 0 }])
            .mockResolvedValueOnce([]);
        mocks.legacy.mockResolvedValue({ board: { boardId: 7 }, memos: [] });
        expect((await GET(request(), context)).status).toBe(200);
        expect(mocks.legacy).toHaveBeenCalledWith({ boardId: 7 });
    });

    it("stops serving the snapshot once the board moved to change sync", async () => {
        mocks.limit
            .mockResolvedValueOnce([{ boardId: 7 }])
            .mockResolvedValueOnce([{ boardId: 7, mode: "delta", revision: 9 }]);
        const response = await GET(request(), context);
        expect(response.headers.get("X-Storage-Mode")).toBe("delta");
        expect(await response.json()).toEqual({ mode: "delta", revision: 9 });
        expect(mocks.legacy).not.toHaveBeenCalled();
    });

    it("refuses a whole-snapshot write on a board that moved to change sync", async () => {
        await PUT(request(), context);
        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
        expect(query.sql).toContain("NOT EXISTS (SELECT 1 FROM board_sync WHERE board_id = $");
        expect(query.sql).toContain("mode <> 'snapshot'");
    });

});

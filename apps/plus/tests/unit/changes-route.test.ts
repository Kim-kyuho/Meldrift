import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { GET, POST } from "@/app/api/boards/[boardId]/changes/route";
import { changeRequestDigest, parseChangeRequest } from "@/lib/sync-operations";

const mocks = vi.hoisted(() => ({
    user: vi.fn(), permission: vi.fn(), batch: vi.fn(), limit: vi.fn(), assetRows: vi.fn(), select: vi.fn(),
    readAssetBytes: vi.fn(), discardAsset: vi.fn(),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/lib/assets")>(),
    readAssetBytes: mocks.readAssetBytes,
    discardAsset: mocks.discardAsset,
}));
vi.mock("@/lib/auth/current-user", () => ({
    getCurrentUserFromRequest: mocks.user, getCardPermissionMessage: mocks.permission,
}));
vi.mock("@/lib/auth/session", () => ({
    getSessionTokenHash: () => "current-session", sessionCookieName: "session",
}));
const where = () => Object.assign(Promise.resolve(mocks.assetRows()), { limit: mocks.limit });
vi.mock("@/lib/db", () => ({ getDb: () => ({
    execute: (statement: SQL) => statement,
    batch: mocks.batch,
    select: mocks.select,
}) }));

const mutationId = "mutation-identifier-1234";
const context = { params: Promise.resolve({ boardId: "7" }) };
const dialect = new PgDialect();

const memoFields = {
    x: 10, y: 20, z: 1, width: 300, height: 200,
    content: "<p>memo</p>", color: "#fffadc", sortOrder: 1,
};
const body = (operations: unknown[], overrides: Record<string, unknown> = {}) => ({
    baseRevision: 2, mutationId, operations, ...overrides,
});

function request(payload: unknown, headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost/api/boards/7/changes?mutationId=m-1", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json", ...headers },
    });
}

const statements = () => (mocks.batch.mock.calls[0][0] as SQL[])
    .map((statement) => dialect.sqlToQuery(statement).sql.replace(/\s+/g, " ").trim());

describe("POST /api/boards/[boardId]/changes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.mockResolvedValue({ id: 5, isApproved: true });
        mocks.permission.mockReturnValue(null);
        mocks.limit.mockResolvedValue([]);
        mocks.assetRows.mockReturnValue([]);
        mocks.select.mockReturnValue({ from: () => ({ where }) });
        mocks.readAssetBytes.mockResolvedValue(null);
        mocks.discardAsset.mockResolvedValue(undefined);
        mocks.batch.mockImplementation(async (queries: SQL[]) =>
            queries.map((_, index) => ({ rows: index === queries.length - 1 ? [{ revision: 3 }] : [] })));
    });

    it("rejects unauthenticated writes before touching the database", async () => {
        mocks.user.mockResolvedValue(null);
        mocks.permission.mockReturnValue("Please sign in before editing cards.");

        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 1 } },
        ])), context);

        expect(response.status).toBe(403);
        expect(mocks.batch).not.toHaveBeenCalled();
    });


    it("rejects a request over the byte limit before parsing it", async () => {
        const oversized = request(body([{
            type: "memo", syncId: "memo-1", action: "update", changes: { content: "x".repeat(1024 * 1024 + 1) },
        }]));

        expect((await POST(oversized, context)).status).toBe(413);
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("moves an image without touching its bytes", async () => {
        const response = await POST(request(body([
            { type: "image", syncId: "image-1", action: "update", changes: { x: 420, y: 180 } },
        ])), context);

        expect(response.status).toBe(200);
        expect(mocks.select).not.toHaveBeenCalled();
        expect(statements()[1]).toContain("UPDATE images SET x = $");
    });

    it("maps image fields onto the existing image columns", async () => {
        mocks.assetRows.mockReturnValue([{ assetId: "asset-1" }]);

        await POST(request(body([{
            type: "image", syncId: "image-1", action: "create", asset: true,
            changes: {
                x: 0, y: 0, z: 1, width: 400, height: 300,
                url: "", label: "a.webp", assetId: "asset-1",
            },
        }])), context);

        const sql = statements()[1];
        expect(sql).toContain("INSERT INTO images (board_id, sync_id, x, y, z, width, height, secure_url, filename, asset_id)");
        expect(sql).toContain("asset_id = excluded.asset_id");
    });

    it("refuses a card that points at bytes the server does not have", async () => {
        mocks.assetRows.mockReturnValue([]);

        const response = await POST(request(body([{
            type: "image", syncId: "image-1", action: "update", asset: true,
            changes: { assetId: "asset-missing" },
        }])), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("Upload the image bytes");
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("writes strokes one row at a time", async () => {
        await POST(request(body([
            { type: "stroke", syncId: "stroke-1", action: "create", changes: { color: "#000", width: 4, points: [[0, 0], [1, 1]] } },
            { type: "stroke", syncId: "stroke-2", action: "delete", changes: {} },
        ])), context);

        const sql = statements();
        expect(sql[1]).toContain("INSERT INTO drawing_strokes (board_id, sync_id, color, width, points)");
        expect(sql[1]).toContain("::jsonb");
        expect(sql[2]).toContain("DELETE FROM drawing_strokes");
    });

    it("locks the board first, writes cards, then raises the revision", async () => {
        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30, sortOrder: 4 } },
        ])), context);

        expect(await response.json()).toEqual({ ok: true, revision: 3 });
        const sql = statements();
        expect(sql).toHaveLength(3);
        expect(sql[0]).toContain("INSERT INTO board_sync (board_id)");
        expect(sql[0]).toContain("ON CONFLICT (board_id) DO UPDATE SET updated_at = board_sync.updated_at");
        expect(sql[1]).toContain("UPDATE memos SET x = $");
        expect(sql[1]).toContain("sort_order = $");
        expect(sql[2]).toContain("UPDATE board_sync SET revision = board_sync.revision + 1");
        expect(sql[2]).toContain("INSERT INTO sync_mutations");
    });

    it("guards every card write and the revision bump with the same condition", async () => {
        await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
            { type: "mermaid", syncId: "mermaid-2", action: "delete", changes: {} },
        ])), context);

        for (const sql of statements().slice(1)) {
            expect(sql).toContain("s.revision = $");
            expect(sql).toContain("s.mode = 'delta'");
            expect(sql).toContain("u.permission_flg = true");
            expect(sql).toContain("u.session_token_hash = $");
            expect(sql).toContain("NOT EXISTS ( SELECT 1 FROM sync_mutations m");
        }
    });

    it("creates cards as an upsert on the sync id so a resend cannot duplicate them", async () => {
        await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "create", changes: memoFields },
        ])), context);

        const sql = statements()[1];
        expect(sql).toContain("INSERT INTO memos (board_id, sync_id, x, y, z, width, height, content, color, sort_order)");
        expect(sql).toContain("ON CONFLICT (board_id, sync_id) DO UPDATE SET x = excluded.x");
        expect(sql).toContain("sort_order = excluded.sort_order, updated_at = now()");
    });

    it("deletes by sync id and casts table sources to jsonb", async () => {
        const source = { columns: [{ id: "c", name: "C" }], rows: [{ id: "r", cells: { c: "1" } }] };
        await POST(request(body([
            { type: "table", syncId: "table-1", action: "update", changes: { source } },
            { type: "memo", syncId: "memo-2", action: "delete", changes: {} },
        ])), context);

        const sql = statements();
        expect(sql[1]).toContain("UPDATE tables SET source = $1::jsonb");
        expect(sql[2]).toContain("DELETE FROM memos");
        expect(sql[2]).toContain("sync_id = $");
    });

    it("returns the stored revision when the same request arrives twice", async () => {
        const payload = body([{ type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } }]);
        const digest = changeRequestDigest(parseChangeRequest(payload));
        mocks.batch.mockImplementation(async (queries: SQL[]) => queries.map(() => ({ rows: [] })));
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: mutationId, digest, revision: 3 }]);

        const response = await POST(request(payload), context);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, revision: 3 });
    });

    it("refuses to reuse a request id for different changes", async () => {
        mocks.batch.mockImplementation(async (queries: SQL[]) => queries.map(() => ({ rows: [] })));
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: mutationId, digest: "other", revision: 3 }]);

        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
        ])), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("already committed different changes");
    });

    it("commits a staged payload and then discards it", async () => {
        const operations = [{ type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } }];
        mocks.readAssetBytes.mockResolvedValue({
            mimeType: "application/json", bytes: Buffer.from(JSON.stringify(operations), "utf8"),
        });

        const response = await POST(request({ baseRevision: 2, mutationId: mutationId, staged: true }), context);

        expect(await response.json()).toEqual({ ok: true, revision: 3 });
        expect(statements()[1]).toContain("UPDATE memos SET x = $");
        expect(mocks.discardAsset).toHaveBeenCalledWith(expect.anything(), 7, mutationId);
    });

    it("answers a resend once the staged payload is gone", async () => {
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: mutationId, digest: "x", revision: 9 }]);

        const response = await POST(request({ baseRevision: 2, mutationId: mutationId, staged: true }), context);

        expect(await response.json()).toEqual({ ok: true, revision: 9 });
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("refuses a staged commit whose payload never arrived", async () => {
        const response = await POST(request({ baseRevision: 2, mutationId: mutationId, staged: true }), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("no longer available");
    });

    it("tells a client whether an unfinished save landed", async () => {
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: "m-1", revision: 12 }]);

        const found = await GET(request({}), context);
        expect(await found.json()).toEqual({ ok: true, applied: true, revision: 12 });

        mocks.limit.mockResolvedValue([]);
        const missing = await GET(request({}), context);
        expect(await missing.json()).toEqual({ ok: true, applied: false, revision: null });
    });

    it("reports a stale revision or lost lease as a conflict", async () => {
        mocks.batch.mockImplementation(async (queries: SQL[]) => queries.map(() => ({ rows: [] })));

        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
        ])), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("Reload to recover");
    });
});

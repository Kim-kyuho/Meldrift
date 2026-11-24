import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { getTableName, type SQL, type Table } from "drizzle-orm";
import { GET, POST } from "@/app/api/boards/[boardId]/changes/route";
import { changeRequestDigest, parseChangeRequest } from "@/lib/sync-operations";

const mocks = vi.hoisted(() => ({
    user: vi.fn(), permission: vi.fn(), batch: vi.fn(), limit: vi.fn(), assetRows: vi.fn(), select: vi.fn(),
    readAssetBytes: vi.fn(), discardAsset: vi.fn(), liveStore: vi.fn(),
}));
vi.mock("@/lib/live/store", () => ({ getLiveStore: mocks.liveStore }));
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
    select: () => ({ from: (table: Table) => getTableName(table) === "boards"
        ? { where: () => ({ limit: async () => [{ boardId: 7, ownerId: "owner@example.com", privateFlg: 0, collabFlg: 1 }] }) }
        : mocks.select().from(table) }),
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

describe("보드 변경 확정 API: POST /api/boards/[boardId]/changes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.mockResolvedValue({ id: 5, isApproved: true, email: "owner@example.com" });
        mocks.permission.mockReturnValue(null);
        mocks.liveStore.mockReturnValue(null);
        mocks.limit.mockResolvedValue([]);
        mocks.assetRows.mockReturnValue([]);
        mocks.select.mockReturnValue({ from: () => ({ where }) });
        mocks.readAssetBytes.mockResolvedValue(null);
        mocks.discardAsset.mockResolvedValue(undefined);
        mocks.batch.mockImplementation(async (queries: SQL[]) =>
            queries.map((_, index) => ({ rows: index === queries.length - 1 ? [{ revision: 3 }] : [] })));
    });

    it("데이터베이스에 접근하기 전에 미인증 쓰기를 거부한다", async () => {
        mocks.user.mockResolvedValue(null);
        mocks.permission.mockReturnValue("Please sign in before editing cards.");

        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 1 } },
        ])), context);

        expect(response.status).toBe(401);
        expect(mocks.batch).not.toHaveBeenCalled();
    });


    it("파싱 전에 바이트 제한을 초과한 요청을 거부한다", async () => {
        const oversized = request(body([{
            type: "memo", syncId: "memo-1", action: "update", changes: { content: "x".repeat(1024 * 1024 + 1) },
        }]));

        expect((await POST(oversized, context)).status).toBe(413);
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("바이너리를 변경하지 않고 이미지를 이동한다", async () => {
        const response = await POST(request(body([
            { type: "image", syncId: "image-1", action: "update", changes: { x: 420, y: 180 } },
        ])), context);

        expect(response.status).toBe(200);
        expect(mocks.select).not.toHaveBeenCalled();
        expect(statements()[1]).toContain("UPDATE images SET x = $");
    });

    it("이미지 필드를 기존 이미지 열에 대응시킨다", async () => {
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

    it("서버에 없는 바이트를 참조하는 카드를 거부한다", async () => {
        mocks.assetRows.mockReturnValue([]);

        const response = await POST(request(body([{
            type: "image", syncId: "image-1", action: "update", asset: true,
            changes: { assetId: "asset-missing" },
        }])), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("Upload the image bytes");
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("획을 한 행씩 저장한다", async () => {
        await POST(request(body([
            { type: "stroke", syncId: "stroke-1", action: "create", changes: { color: "#000", width: 4, points: [[0, 0], [1, 1]] } },
            { type: "stroke", syncId: "stroke-2", action: "delete", changes: {} },
        ])), context);

        const sql = statements();
        expect(sql[1]).toContain("INSERT INTO drawing_strokes (board_id, sync_id, color, width, points)");
        expect(sql[1]).toContain("::jsonb");
        expect(sql[2]).toContain("DELETE FROM drawing_strokes");
    });

    it("보드를 먼저 잠그고 카드를 저장한 뒤 리비전을 올린다", async () => {
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

    it("모든 카드 쓰기와 리비전 증가에 같은 보호 조건을 적용한다", async () => {
        await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
            { type: "mermaid", syncId: "mermaid-2", action: "delete", changes: {} },
        ])), context);

        for (const sql of statements().slice(1)) {
            expect(sql).toContain("s.revision = $");
            expect(sql).toContain("s.mode = 'delta'");
            expect(sql).toContain("u.role = 'admin' OR (u.permission_flg AND (b.owner_id = u.email OR EXISTS");
            expect(sql).toContain("m.role = 'editor'");
            expect(sql).toContain("u.session_token_hash = $");
            expect(sql).toContain("NOT EXISTS ( SELECT 1 FROM sync_mutations m");
        }
    });

    it("Live 클라이언트는 판 번호 대신 다른 클라이언트 커밋과의 키 겹침을 검사한다", async () => {
        await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30, sortOrder: 2 } },
        ]), { "X-Meldrift-Client": "0f8fad5b-d9cb-469f-a165-70867728950e" }), context);

        const queries = (mocks.batch.mock.calls[0][0] as SQL[]).map((statement) => dialect.sqlToQuery(statement));
        for (const query of queries.slice(1)) {
            const sql = query.sql.replace(/\s+/g, " ");
            expect(sql).toContain("s.revision >= $");
            expect(sql).toContain("min(r.revision) - 1 FROM sync_mutations r");
            expect(sql).toContain("m.author_client IS DISTINCT FROM $");
            expect(sql).toContain("m.touched && ARRAY(SELECT jsonb_array_elements_text(");
            expect(query.params).toContain(JSON.stringify(["order:memo", "memo:memo-1"]));
        }
        const commit = queries[queries.length - 1];
        expect(commit.sql).toContain("INSERT INTO sync_mutations (board_id, mutation_id, digest, revision, touched, operations, author_id, author_client)");
        expect(commit.params).toContain("0f8fad5b-d9cb-469f-a165-70867728950e");
    });

    it("다른 사람이 잠근 카드를 건드리는 커밋은 쓰기 전에 거절한다", async () => {
        const store = {
            foreignLock: vi.fn(async () => ({ key: "memo:memo-1", email: "other@example.com" })),
            recordTouched: vi.fn(),
        };
        mocks.liveStore.mockReturnValue(store);

        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
        ]), { "X-Meldrift-Client": "0f8fad5b-d9cb-469f-a165-70867728950e" }), context);

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: "locked", key: "memo:memo-1" });
        expect(store.foreignLock).toHaveBeenCalledWith(7, "5:0f8fad5b-d9cb-469f-a165-70867728950e", ["memo:memo-1"]);
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("Redis 응답이 지연되어도 최종 저장을 끝낸다", async () => {
        vi.useFakeTimers();
        const never = () => new Promise<never>(() => {});
        const store = { foreignLock: vi.fn(never), recordTouched: vi.fn(never) };
        mocks.liveStore.mockReturnValue(store);

        const pending = POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
        ]), { "X-Meldrift-Client": "0f8fad5b-d9cb-469f-a165-70867728950e" }), context);
        await vi.advanceTimersByTimeAsync(4100);
        const response = await pending;
        vi.useRealTimers();

        expect(response.status).toBe(200);
        expect(mocks.batch).toHaveBeenCalledOnce();
        expect(store.recordTouched).toHaveBeenCalledOnce();
    });

    it("커밋 후 키별 판 번호와 방의 최신 판 번호를 기록한다", async () => {
        const store = { foreignLock: vi.fn(async () => null), recordTouched: vi.fn() };
        mocks.liveStore.mockReturnValue(store);
        const operations = [{ type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } }];

        const response = await POST(request(body(operations), {
            "X-Meldrift-Client": "0f8fad5b-d9cb-469f-a165-70867728950e",
        }), context);

        expect(response.status).toBe(200);
        expect(store.recordTouched).toHaveBeenCalledWith(7, ["memo:memo-1", "$head"], 3);
    });

    it("동기화 식별자 기준의 업서트로 카드를 생성해 재전송 중복을 방지한다", async () => {
        await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "create", changes: memoFields },
        ])), context);

        const sql = statements()[1];
        expect(sql).toContain("INSERT INTO memos (board_id, sync_id, x, y, z, width, height, content, color, sort_order)");
        expect(sql).toContain("ON CONFLICT (board_id, sync_id) DO UPDATE SET x = excluded.x");
        expect(sql).toContain("sort_order = excluded.sort_order, updated_at = now()");
    });

    it("동기화 식별자로 삭제하고 표 소스를 jsonb로 변환한다", async () => {
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

    it("같은 요청을 두 번 받아도 저장된 리비전을 반환한다", async () => {
        const payload = body([{ type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } }]);
        const digest = changeRequestDigest(parseChangeRequest(payload));
        mocks.batch.mockImplementation(async (queries: SQL[]) => queries.map(() => ({ rows: [] })));
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: mutationId, digest, revision: 3 }]);

        const response = await POST(request(payload), context);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, revision: 3 });
    });

    it("다른 변경에 같은 요청 식별자를 재사용하지 못하게 한다", async () => {
        mocks.batch.mockImplementation(async (queries: SQL[]) => queries.map(() => ({ rows: [] })));
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: mutationId, digest: "other", revision: 3 }]);

        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
        ])), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("already committed different changes");
    });

    it("임시 저장한 본문을 확정한 뒤 정리한다", async () => {
        const operations = [{ type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } }];
        mocks.readAssetBytes.mockResolvedValue({
            mimeType: "application/json", bytes: Buffer.from(JSON.stringify(operations), "utf8"),
        });

        const response = await POST(request({ baseRevision: 2, mutationId: mutationId, staged: true }), context);

        expect(await response.json()).toEqual({ ok: true, revision: 3 });
        expect(statements()[1]).toContain("UPDATE memos SET x = $");
        expect(mocks.discardAsset).toHaveBeenCalledWith(expect.anything(), 7, mutationId);
    });

    it("임시 본문이 삭제된 뒤의 재전송에도 응답한다", async () => {
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: mutationId, digest: "x", revision: 9 }]);

        const response = await POST(request({ baseRevision: 2, mutationId: mutationId, staged: true }), context);

        expect(await response.json()).toEqual({ ok: true, revision: 9 });
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("본문이 도착하지 않은 임시 변경 확정을 거부한다", async () => {
        const response = await POST(request({ baseRevision: 2, mutationId: mutationId, staged: true }), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("no longer available");
    });

    it("완료되지 않은 저장이 반영되었는지 클라이언트에 알린다", async () => {
        mocks.limit.mockResolvedValue([{ boardId: 7, mutationId: "m-1", revision: 12 }]);

        const found = await GET(request({}), context);
        expect(await found.json()).toEqual({ ok: true, applied: true, revision: 12 });

        mocks.limit.mockResolvedValue([]);
        const missing = await GET(request({}), context);
        expect(await missing.json()).toEqual({ ok: true, applied: false, revision: null });
    });

    it("오래된 리비전이나 리스 상실을 충돌로 알린다", async () => {
        mocks.batch.mockImplementation(async (queries: SQL[]) => queries.map(() => ({ rows: [] })));

        const response = await POST(request(body([
            { type: "memo", syncId: "memo-1", action: "update", changes: { x: 30 } },
        ])), context);

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("Reload to recover");
    });
});

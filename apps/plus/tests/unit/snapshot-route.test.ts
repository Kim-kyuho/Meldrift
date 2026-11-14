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

describe("스냅샷 API", () => {
    beforeEach(() => {
        mocks.user.mockResolvedValue({ id: 5, isApproved: true });
        mocks.permission.mockReturnValue(null);
        mocks.execute.mockResolvedValue({ rows: [{ revision: 3 }] });
        mocks.decode.mockResolvedValue({});
        mocks.limit.mockResolvedValue([{ boardId: 7 }]);
    });

    it("본문을 읽기 전에 미인증 쓰기를 거부한다", async () => {
        mocks.user.mockResolvedValue(null);
        expect((await PUT(request(), context)).status).toBe(403);
        expect(mocks.decode).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it.each([["X-Snapshot-Revision", "-1"], ["X-Snapshot-Mutation", ""]])("잘못된 쓰기 메타데이터를 거부한다", async (name, value) => {
        expect((await PUT(request({ [name]: value }), context)).status).toBe(400);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("기준 리비전의 명시를 요구한다", async () => {
        const input = request();
        input.headers.delete("X-Snapshot-Revision");
        expect((await PUT(input, context)).status).toBe(400);
    });

    it("SQLite 디코딩 전에 크기를 초과한 본문을 거부한다", async () => {
        expect((await PUT(request({ "Content-Length": String(4 * 1024 * 1024 + 1) }), context)).status).toBe(413);
        expect(mocks.decode).not.toHaveBeenCalled();
    });

    it("손상되었거나 다른 보드의 스냅샷을 거부한다", async () => {
        mocks.decode.mockRejectedValueOnce(new Error("Snapshot contains another board."));
        expect((await PUT(request(), context)).status).toBe(400);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("원자적 쓰기에서 리비전과 현재 세션을 확인한다", async () => {
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

    it("오래된 쓰기를 허용하지 않고 충돌을 반환한다", async () => {
        mocks.execute.mockResolvedValue({ rows: [] });
        expect((await PUT(request(), context)).status).toBe(409);
    });

    it("삭제된 보드를 되살리는 대신 404를 반환한다", async () => {
        mocks.limit.mockResolvedValue([]);
        expect((await GET(request(), context)).status).toBe(404);
        expect(mocks.legacy).not.toHaveBeenCalled();
    });

    it("캐시 없이 바이너리 바이트와 확정된 리비전을 반환한다", async () => {
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

    it("첫 스냅샷 이전에만 구버전 카드를 불러온다", async () => {
        mocks.limit
            .mockResolvedValueOnce([{ boardId: 7 }])
            .mockResolvedValueOnce([{ boardId: 7, mode: "snapshot", revision: 0 }])
            .mockResolvedValueOnce([]);
        mocks.legacy.mockResolvedValue({ board: { boardId: 7 }, memos: [] });
        expect((await GET(request(), context)).status).toBe(200);
        expect(mocks.legacy).toHaveBeenCalledWith({ boardId: 7 });
    });

    it("보드를 변경분 동기화로 전환하면 스냅샷 제공을 중단한다", async () => {
        mocks.limit
            .mockResolvedValueOnce([{ boardId: 7 }])
            .mockResolvedValueOnce([{ boardId: 7, mode: "delta", revision: 9 }]);
        const response = await GET(request(), context);
        expect(response.headers.get("X-Storage-Mode")).toBe("delta");
        expect(await response.json()).toEqual({ mode: "delta", revision: 9 });
        expect(mocks.legacy).not.toHaveBeenCalled();
    });

    it("변경분 동기화로 전환한 보드의 전체 스냅샷 쓰기를 거부한다", async () => {
        await PUT(request(), context);
        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
        expect(query.sql).toContain("NOT EXISTS (SELECT 1 FROM board_sync WHERE board_id = $");
        expect(query.sql).toContain("mode <> 'snapshot'");
    });

});

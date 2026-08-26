import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { POST } from "@/app/api/memos/order/route";

// 순서 계산은 서버가 DB 값으로 한다. 클라이언트가 보낸 순서 값은 요청에 아예 없다.

const mocks = vi.hoisted(() => ({
    getDb: vi.fn(),
    getCurrentUserFromRequest: vi.fn(),
    getCardPermissionMessage: vi.fn(),
    execute: vi.fn(),
    orderBy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/auth/current-user", () => ({
    getCurrentUserFromRequest: mocks.getCurrentUserFromRequest,
    getCardPermissionMessage: mocks.getCardPermissionMessage,
}));

const createRequest = (body: unknown) =>
    new NextRequest("http://localhost/api/memos/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

const givenBoardMemos = (memos: { id: number; sortOrder: number }[]) => {
    mocks.orderBy.mockResolvedValue(memos);
    mocks.getDb.mockReturnValue({
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({ orderBy: mocks.orderBy })),
            })),
        })),
        execute: mocks.execute,
    });
};

describe("POST /api/memos/order", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUserFromRequest.mockResolvedValue({ id: 1, isApproved: true });
        mocks.getCardPermissionMessage.mockReturnValue(null);
        mocks.execute.mockResolvedValue(undefined);
    });

    it("shifts only the memos between the old and the new place", async () => {
        givenBoardMemos([
            { id: 10, sortOrder: 1 },
            { id: 20, sortOrder: 2 },
            { id: 30, sortOrder: 3 },
            { id: 40, sortOrder: 4 },
        ]);

        const response = await POST(createRequest({ boardId: 7, memoId: 40, targetIndex: 1 }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.memos).toEqual([
            { id: 10, sortOrder: 1 },
            { id: 20, sortOrder: 3 },
            { id: 30, sortOrder: 4 },
            { id: 40, sortOrder: 2 },
        ]);
        // 자리를 지킨 첫 메모까지 다시 쓰지 않는다. 바뀐 세 줄만 한 문장으로 나간다.
        expect(mocks.execute).toHaveBeenCalledOnce();

        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0] as SQL);
        expect(query.sql.replace(/\s+/g, " ").trim()).toBe(
            'UPDATE "memos" AS m SET sort_order = reordered.sort_order '
            + "FROM (VALUES ($1::integer, $2::integer), ($3::integer, $4::integer), ($5::integer, $6::integer)) "
            + "AS reordered(id, sort_order) WHERE m.id = reordered.id AND m.board_id = $7"
        );
        expect(query.params).toEqual([20, 3, 30, 4, 40, 2, 7]);
    });

    it("writes nothing when the memo is already in that place", async () => {
        givenBoardMemos([
            { id: 10, sortOrder: 1 },
            { id: 20, sortOrder: 2 },
        ]);

        const response = await POST(createRequest({ boardId: 7, memoId: 10, targetIndex: 0 }));

        expect(response.status).toBe(200);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("refuses a memo that is not on the board", async () => {
        givenBoardMemos([{ id: 10, sortOrder: 1 }]);

        const response = await POST(createRequest({ boardId: 7, memoId: 99, targetIndex: 0 }));

        expect(response.status).toBe(404);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("refuses a place past the end of the board", async () => {
        givenBoardMemos([{ id: 10, sortOrder: 1 }]);

        const response = await POST(createRequest({ boardId: 7, memoId: 10, targetIndex: 5 }));

        expect(response.status).toBe(400);
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("refuses a malformed request before reading the board", async () => {
        givenBoardMemos([{ id: 10, sortOrder: 1 }]);

        const response = await POST(createRequest({ boardId: 0, memoId: 10, targetIndex: 0 }));

        expect(response.status).toBe(400);
        expect(mocks.orderBy).not.toHaveBeenCalled();
    });

    it("refuses a reader who cannot edit cards", async () => {
        givenBoardMemos([{ id: 10, sortOrder: 1 }]);
        mocks.getCardPermissionMessage.mockReturnValue("Please sign in before editing cards.");

        const response = await POST(createRequest({ boardId: 7, memoId: 10, targetIndex: 0 }));
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.message).toBe("Please sign in before editing cards.");
        expect(mocks.orderBy).not.toHaveBeenCalled();
    });
});

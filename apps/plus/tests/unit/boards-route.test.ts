import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/boards/route";

const mocks = vi.hoisted(() => ({ user: vi.fn(), returning: vi.fn(), values: vi.fn(), conflict: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    insert: (table: { _: { name: string } }) => ({
        values: (row: unknown) => {
            mocks.values(table, row);
            return { returning: mocks.returning, onConflictDoNothing: mocks.conflict };
        },
    }),
}) }));

const create = (body: unknown) => POST(new NextRequest("http://localhost/api/boards", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}));

describe("POST /api/boards", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.mockResolvedValue({ id: 1, role: "admin" });
        mocks.returning.mockResolvedValue([{ boardId: 42, title: "New" }]);
        mocks.conflict.mockResolvedValue(undefined);
    });

    it("새 보드는 변경분 저장으로 태어난다", async () => {
        const response = await create({ title: "New", width: 7680, height: 4320, ownerId: "me" });

        expect(response.status).toBe(200);
        const [, row] = mocks.values.mock.calls.at(-1)!;
        expect(row).toEqual({ boardId: 42, revision: 0, mode: "delta" });
        expect(mocks.conflict).toHaveBeenCalledOnce();
    });

    it("관리자가 아니면 보드를 만들지 않는다", async () => {
        mocks.user.mockResolvedValue({ id: 1, role: "user" });

        expect((await create({ title: "New", width: 1, height: 1, ownerId: "me" })).status).toBe(403);
        expect(mocks.values).not.toHaveBeenCalled();
    });

    it("제목과 크기가 없으면 거절한다", async () => {
        expect((await create({ title: "", width: 1, height: 1, ownerId: "me" })).status).toBe(400);
        expect(mocks.values).not.toHaveBeenCalled();
    });
});

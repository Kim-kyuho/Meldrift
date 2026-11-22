import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { POST } from "@/app/api/boards/route";

const mocks = vi.hoisted(() => ({ user: vi.fn(), batch: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ execute: mocks.execute, batch: mocks.batch }) }));

const create = (body: unknown) => POST(new NextRequest("http://localhost/api/boards", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}));
const titleAndSize = { title: "New", width: 7680, height: 4320 };

describe("보드 생성 API: POST /api/boards", () => {
    beforeEach(() => {
        mocks.user.mockResolvedValue({ id: 1, role: "user", isApproved: true, email: "owner@example.com" });
        mocks.batch.mockResolvedValue([{}, { rows: [{ boardId: 42 }] }]);
    });

    it("creates a private board by default and derives the owner from the live session", async () => {
        const response = await create({ ...titleAndSize, ownerId: "spoofed@example.com" });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ board: { boardId: 42 } });
        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]);
        expect(query.sql).toContain("email");
        expect(query.sql).toContain("INSERT INTO board_sync");
        expect(query.sql).toContain("'delta'");
        expect(query.params.slice(0, 5)).toEqual(["New", 7680, 4320, 1, 0]);
        expect(query.params).not.toContain("spoofed@example.com");
    });

    it("allows an administrator to create a public board even without the write flag", async () => {
        mocks.user.mockResolvedValue({ id: 2, role: "admin", isApproved: false });
        expect((await create({ ...titleAndSize, privateFlg: 0 })).status).toBe(200);
        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]);
        expect(query.params[3]).toBe(0);
    });

    it("creates a live collaboration board only when requested", async () => {
        expect((await create({ ...titleAndSize, collabFlg: 1 })).status).toBe(200);
        const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[1][0]);
        expect(query.sql).toContain("collab_flg");
        expect(query.params[4]).toBe(1);
        expect((await create({ ...titleAndSize, collabFlg: 2 })).status).toBe(400);
    });

    it("rejects signed-in members without write permission", async () => {
        mocks.user.mockResolvedValue({ id: 1, role: "user", isApproved: false });
        expect((await create(titleAndSize)).status).toBe(403);
        expect(mocks.batch).not.toHaveBeenCalled();
    });

    it("validates dimensions and visibility", async () => {
        expect((await create({ ...titleAndSize, privateFlg: 2 })).status).toBe(400);
        expect((await create({ ...titleAndSize, width: 0 })).status).toBe(400);
        expect(mocks.batch).not.toHaveBeenCalled();
    });
});

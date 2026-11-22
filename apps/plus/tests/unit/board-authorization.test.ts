import { getTableName, type Table } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { boardAccess } from "@/lib/board-access";
import { GET as getState } from "@/app/api/boards/[boardId]/state/route";
import { GET as getAsset } from "@/app/api/boards/[boardId]/assets/[assetId]/bytes/route";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";

const mocks = vi.hoisted(() => ({ user: vi.fn(), board: vi.fn(), load: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user }));
vi.mock("@/lib/board-state-store", () => ({ loadBoardState: mocks.load }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    select: () => ({ from: (table: Table) => ({ where: () => ({
        limit: async () => getTableName(table) === "boards" ? mocks.board() : [{ mode: "delta", revision: 0 }],
    }) }) }),
    execute: mocks.execute,
}) }));

const request = new NextRequest("http://localhost/api/boards/7/state");
const stateParams = { params: Promise.resolve({ boardId: "7" }) };
const assetParams = { params: Promise.resolve({ boardId: "7", assetId: "image-1" }) };
const owner = { id: 1, email: "owner@example.com", role: "user", isApproved: true };
const other = { ...owner, id: 2, email: "other@example.com" };
const administrator = { ...other, role: "admin", isApproved: false };
const boardInfo = { boardId: 7, title: "Board", width: 100, height: 80 };
const board = { ...boardInfo, ownerId: owner.email };

describe("Plus board authorization", () => {
    beforeEach(() => {
        mocks.board.mockReturnValue([{ ...board, privateFlg: 1 }]);
        mocks.user.mockResolvedValue(null);
        mocks.load.mockResolvedValue({ ...createEmptyBoardSnapshot(), board: boardInfo });
        mocks.execute.mockResolvedValue({ rows: [{ mime_type: "image/png", bytes: Buffer.from([1]) }] });
    });

    it("serves a public board to a guest and hides it on the same URLs after a visibility change", async () => {
        mocks.board.mockReturnValue([{ ...board, privateFlg: 0 }]);
        expect((await getState(request, stateParams)).status).toBe(200);
        expect((await getAsset(request, assetParams)).status).toBe(200);

        mocks.board.mockReturnValue([{ ...board, privateFlg: 1 }]);
        expect((await getState(request, stateParams)).status).toBe(404);
        expect((await getAsset(request, assetParams)).status).toBe(404);
        expect(mocks.load).toHaveBeenCalledOnce();
        expect(mocks.execute).toHaveBeenCalledOnce();
    });

    it("hides other members' private boards even when the signed-in member can write", async () => {
        mocks.user.mockResolvedValue(other);
        expect((await getState(request, stateParams)).status).toBe(404);
        expect((await getAsset(request, assetParams)).status).toBe(404);
        expect(mocks.load).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });

    it("allows the owner to read after writing permission is revoked but rejects writes", async () => {
        mocks.user.mockResolvedValue(owner);
        expect((await boardAccess(request, 7, "edit")).failure).toBeNull();

        mocks.user.mockResolvedValue({ ...owner, isApproved: false });
        expect((await getState(request, stateParams)).status).toBe(200);
        expect((await boardAccess(request, 7, "edit")).failure?.status).toBe(403);
    });

    it("lets administrators manage private boards without the write flag", async () => {
        mocks.user.mockResolvedValue(administrator);
        expect((await boardAccess(request, 7, "edit")).failure).toBeNull();
        expect((await getState(request, stateParams)).status).toBe(200);
    });

    it("refuses edits to another member's public board", async () => {
        mocks.user.mockResolvedValue(other);
        mocks.board.mockReturnValue([{ ...board, privateFlg: 0 }]);
        expect((await getState(request, stateParams)).status).toBe(200);
        expect((await boardAccess(request, 7, "edit")).failure?.status).toBe(403);
    });
});

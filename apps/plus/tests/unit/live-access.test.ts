import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as issueToken } from "@/app/api/boards/[boardId]/live/token/route";
import { POST as exchange } from "@/app/api/boards/[boardId]/live/route";
import { createSessionToken, sessionCookieName } from "@/lib/auth/session";
import { MemoryLiveStore } from "@/lib/live/store/memory-store";
import type { RoomGrant } from "@/lib/live/p2p/protocol";

const mocks = vi.hoisted(() => ({ boardAccess: vi.fn(), store: vi.fn(), head: vi.fn() }));
vi.mock("@/lib/board-access", () => ({
    boardAccess: mocks.boardAccess,
    validBoardId: (id: number) => Number.isSafeInteger(id) && id > 0,
}));
vi.mock("@/lib/live/commit-events", async (original) => ({
    ...await original<typeof import("@/lib/live/commit-events")>(),
    boardHeadRevision: mocks.head,
}));
vi.mock("@/lib/live/store", () => ({ liveEnabled: () => true, getLiveStore: mocks.store }));

const board = { boardId: 7, ownerId: "owner@example.com", privateFlg: 0 as const, collabFlg: 1 as const };
const user = { id: 3, email: "member@example.com", role: "user", isApproved: true };
const clientId = "0f8fad5b-d9cb-469f-a165-70867728950e";
const leaseId = "8ec2f551-d335-42a9-9fd0-b64d10171ec6";

const context = (boardId = "7") => ({ params: Promise.resolve({ boardId }) });

function tokenRequest(cookie = false) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (cookie) {
        headers.set("Cookie", sessionCookieName + "=" + createSessionToken());
    }
    return new NextRequest("http://localhost/api/boards/7/live/token", {
        method: "POST", body: JSON.stringify({ clientId, leaseId }), headers,
    });
}

function roomRequest(body: object, token?: string) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (token) {
        headers.set("Authorization", "Bearer " + token);
    }
    return new Request("http://localhost/api/boards/7/live", { method: "POST", body: JSON.stringify(body), headers });
}

describe("Plus Live admission", () => {
    beforeEach(() => {
        mocks.store.mockReturnValue(new MemoryLiveStore());
        mocks.head.mockResolvedValue(5);
    });

    it("requires a login even for a publicly readable board", async () => {
        mocks.boardAccess.mockResolvedValue({ failure: null, board, user: null, memberRole: null });
        expect((await issueToken(tokenRequest(), context())).status).toBe(401);
    });

    it("automatically elects an approved editor as host and returns the current cloud revision", async () => {
        mocks.boardAccess.mockResolvedValue({ failure: null, board, user, memberRole: "editor" });
        const response = await issueToken(tokenRequest(true), context());
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            token: expect.any(String), status: { head: 5, hostId: clientId, self: { clientId, role: "editor" } },
        });
    });

    it("rejects admission on a standard board", async () => {
        mocks.boardAccess.mockResolvedValue({ failure: null, board: { ...board, collabFlg: 0 }, user, memberRole: "editor" });
        expect((await issueToken(tokenRequest(true), context())).status).toBe(404);
    });

    it("rejects missing credentials and prevents a seat token from authorizing another board", async () => {
        mocks.boardAccess.mockResolvedValue({ failure: null, board, user, memberRole: "editor" });
        const grant = await (await issueToken(tokenRequest(true), context())).json() as RoomGrant;
        expect((await exchange(roomRequest({ kind: "leave" }), context())).status).toBe(401);
        expect((await exchange(roomRequest({ kind: "leave" }, grant.token), context("8"))).status).toBe(401);
    });

    it("allows viewers to join automatically without obtaining write locks", async () => {
        mocks.boardAccess.mockResolvedValue({ failure: null, board, user, memberRole: "viewer" });
        const grant = await (await issueToken(tokenRequest(true), context())).json() as RoomGrant;
        expect(grant.status.hostId).toBeNull();
        const result = await exchange(roomRequest({ kind: "acquire", keys: ["memo:a"], intent: "edit" }, grant.token), context());
        expect(result.status).toBe(403);
    });
});

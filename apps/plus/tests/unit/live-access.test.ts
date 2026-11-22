import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as issueToken } from "@/app/api/boards/[boardId]/live/token/route";
import { resolveLiveIdentity } from "@/lib/live/server/identity";

const mocks = vi.hoisted(() => ({ boardAccess: vi.fn(), boardAccessFor: vi.fn(), sessionUser: vi.fn() }));
vi.mock("@/lib/board-access", () => ({ boardAccess: mocks.boardAccess, boardAccessFor: mocks.boardAccessFor }));
vi.mock("@/lib/auth/current-user", () => ({ findSessionUserById: mocks.sessionUser }));
vi.mock("@/lib/live/store", () => ({ liveEnabled: () => true }));

const board = { boardId: 7, ownerId: "owner@example.com", privateFlg: 0 as const, collabFlg: 1 as const };
const clientId = "0f8fad5b-d9cb-469f-a165-70867728950e";
const tokenRequest = () => new NextRequest("http://localhost/api/boards/7/live/token", {
    method: "POST",
    body: JSON.stringify({ clientId }),
    headers: { "Content-Type": "application/json" },
});
const context = { params: Promise.resolve({ boardId: "7" }) };

describe("Live 접속 대상", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("비로그인 사용자에게는 공개 보드여도 연결 토큰을 주지 않는다", async () => {
        mocks.boardAccess.mockResolvedValue({ failure: null, board, user: null, memberRole: null });

        const response = await issueToken(tokenRequest(), context);

        expect(response.status).toBe(401);
    });

    it("로그인한 사용자에게는 토큰을 준다", async () => {
        const user = { id: 3, email: "member@example.com", role: "user", isApproved: true };
        mocks.boardAccess.mockResolvedValue({ failure: null, board, user, memberRole: "editor" });

        const response = await issueToken(tokenRequest(), context);

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ ok: true, token: expect.any(String) });
    });

    it("협업 보드가 아니면 토큰을 주지 않고, 연결도 받지 않는다", async () => {
        const user = { id: 3, email: "member@example.com", role: "user", isApproved: true };
        const standard = { ...board, collabFlg: 0 as const };
        mocks.boardAccess.mockResolvedValue({ failure: null, board: standard, user, memberRole: "editor" });
        mocks.sessionUser.mockResolvedValue(user);
        mocks.boardAccessFor.mockResolvedValue({ failure: null, board: standard, user, memberRole: "editor" });

        expect((await issueToken(tokenRequest(), context)).status).toBe(404);
        const result = await resolveLiveIdentity({ b: 7, u: 3, s: "hash", c: clientId, e: Date.now() + 60_000 });
        expect(result.closeCode).toBe(4404);
    });

    it("사용자 없는 토큰으로는 연결하지 못한다", async () => {
        const result = await resolveLiveIdentity({ b: 7, u: null, s: null, c: clientId, e: Date.now() + 60_000 });

        expect(result.closeCode).toBe(4401);
        expect(mocks.sessionUser).not.toHaveBeenCalled();
        expect(mocks.boardAccessFor).not.toHaveBeenCalled();
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/boards/[boardId]/transition/route";
import { TransitionError } from "@/lib/board-transition";

const mocks = vi.hoisted(() => ({ user: vi.fn(), limit: vi.fn(), transition: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserFromRequest: mocks.user }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }),
}) }));
vi.mock("@/lib/board-transition", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/lib/board-transition")>(),
    transitionBoard: mocks.transition,
}));

const call = (boardId = "7") => POST(
    new NextRequest("http://localhost/api/boards/7/transition", { method: "POST" }),
    { params: Promise.resolve({ boardId }) },
);

describe("보드 전환 API: POST /api/boards/[boardId]/transition", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.mockResolvedValue({ id: 1, role: "admin", isApproved: true });
        mocks.limit.mockResolvedValue([{ boardId: 7, title: "Board", width: 100, height: 80 }]);
        mocks.transition.mockResolvedValue({
            source: "snapshot", revision: 4, assets: 1,
            counts: { memos: 1, images: 1, mermaids: 0, tables: 0, strokes: 1 },
        });
    });

    it("보드를 전환하고 이전한 내용을 알린다", async () => {
        const response = await call();

        expect(await response.json()).toMatchObject({ ok: true, source: "snapshot", revision: 4, assets: 1 });
        expect(mocks.transition).toHaveBeenCalledWith({ boardId: 7, title: "Board", width: 100, height: 80 });
    });

    it.each([["user"], [undefined]])("관리자만 보드를 전환할 수 있다: %s", async (role) => {
        mocks.user.mockResolvedValue(role ? { id: 1, role } : null);

        expect((await call()).status).toBe(403);
        expect(mocks.transition).not.toHaveBeenCalled();
    });

    it("잘못된 보드 식별자와 존재하지 않는 보드를 구분한다", async () => {
        expect((await call("0")).status).toBe(400);

        mocks.limit.mockResolvedValue([]);
        expect((await call()).status).toBe(404);
        expect(mocks.transition).not.toHaveBeenCalled();
    });

    it("검증 실패를 충돌로 알리고 보드를 차단 상태로 유지한다", async () => {
        mocks.transition.mockRejectedValue(new TransitionError("Moved 0 memos but the source had 1."));

        const response = await call();

        expect(response.status).toBe(409);
        expect((await response.json()).message).toContain("Moved 0 memos");
    });
});

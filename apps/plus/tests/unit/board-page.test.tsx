import { beforeEach, describe, expect, it, vi } from "vitest";
import BoardPage from "@/app/boards/[boardId]/page";

const mocks = vi.hoisted(() => ({
    getDb: vi.fn(),
    notFound: vi.fn(),
    selectLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/BoardClient", () => ({ default: vi.fn() }));

describe("BoardPage", () => {
    beforeEach(() => {
        mocks.notFound.mockImplementation(() => {
            throw new Error("NEXT_NOT_FOUND");
        });
        mocks.getDb.mockReturnValue({
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({ limit: mocks.selectLimit })),
                })),
            })),
        });
    });

    it.each(["invalid", "0", "-1", "1.5"])("returns 404 for invalid board id %s", async (boardId) => {
        await expect(BoardPage({ params: Promise.resolve({ boardId }) }))
            .rejects.toThrow("NEXT_NOT_FOUND");

        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.getDb).not.toHaveBeenCalled();
    });

    it("returns 404 when the board does not exist", async () => {
        mocks.selectLimit.mockResolvedValue([]);

        await expect(BoardPage({ params: Promise.resolve({ boardId: "999999" }) }))
            .rejects.toThrow("NEXT_NOT_FOUND");

        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.selectLimit).toHaveBeenCalledOnce();
    });
});

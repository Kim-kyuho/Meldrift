import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardTransfer } from "@/hooks/useBoardTransfer";
import { createEmptyBoardSnapshot } from "@/lib/board-state";
import { importBoardDatabase, resetBoardDatabase } from "@/lib/browser-db/client";

vi.mock("@/lib/browser-db/client", () => ({
    exportBoardDatabase: vi.fn(), importBoardDatabase: vi.fn(),
    replaceBoardState: vi.fn(), resetBoardDatabase: vi.fn(),
}));

function setup() {
    const replaceSnapshot = vi.fn();
    const setMessage = vi.fn();
    const hook = renderHook(() => useBoardTransfer({
        exportDisabled: false, setMessage, getSnapshot: createEmptyBoardSnapshot, replaceSnapshot,
    }));
    return { ...hook, replaceSnapshot, setMessage };
}

describe("useBoardTransfer", () => {
    beforeEach(() => vi.clearAllMocks());

    it("opens and cancels Reset without changing the board", () => {
        const { result, replaceSnapshot } = setup();
        act(() => result.current.handleResetClick());
        expect(result.current.resetDialogOpen).toBe(true);
        act(() => result.current.handleResetCancel());
        expect(result.current.resetDialogOpen).toBe(false);
        expect(replaceSnapshot).not.toHaveBeenCalled();
    });

    it("resets content through the undoable UI replacement without destroying the database", async () => {
        const { result, replaceSnapshot } = setup();
        await act(async () => result.current.handleResetConfirm());
        expect(replaceSnapshot).toHaveBeenCalledWith(createEmptyBoardSnapshot());
        expect(resetBoardDatabase).not.toHaveBeenCalled();
        expect(result.current.resetting).toBe(false);
    });

    it("applies an imported snapshot without reloading the page", async () => {
        const snapshot = createEmptyBoardSnapshot();
        vi.mocked(importBoardDatabase).mockResolvedValueOnce(snapshot);
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result, replaceSnapshot } = setup();
        await act(async () => result.current.handleImport({ target: {
            files: [{ size: 100, arrayBuffer: async () => new ArrayBuffer(100) }], value: "file",
        } } as never));
        expect(replaceSnapshot).toHaveBeenCalledWith(snapshot);
    });

    it("preserves the current board on a failed import", async () => {
        vi.mocked(importBoardDatabase).mockRejectedValueOnce(new Error("Invalid SQLite save"));
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result, replaceSnapshot, setMessage } = setup();
        await act(async () => result.current.handleImport({ target: {
            files: [{ size: 100, arrayBuffer: async () => new ArrayBuffer(100) }], value: "file",
        } } as never));
        expect(replaceSnapshot).not.toHaveBeenCalled();
        expect(setMessage).toHaveBeenLastCalledWith("Invalid SQLite save");
        expect(result.current.transferring).toBe(false);
    });
});

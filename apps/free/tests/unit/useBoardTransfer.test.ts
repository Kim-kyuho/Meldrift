import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardTransfer } from "@/hooks/useBoardTransfer";
import { createEmptyBoardSnapshot } from "@/lib/board-state";
import { resetBoardDatabase } from "@/lib/browser-db/client";

vi.mock("@/lib/browser-db/client", () => ({
    exportBoardDatabase: vi.fn(),
    importBoardDatabase: vi.fn(),
    replaceBoardState: vi.fn(),
    resetBoardDatabase: vi.fn(),
}));

const resetBoardDatabaseMock = vi.mocked(resetBoardDatabase);

describe("useBoardTransfer Reset", () => {
    beforeEach(() => vi.clearAllMocks());

    it("opens and cancels the destructive confirmation without deleting data", () => {
        const { result } = renderHook(() => useBoardTransfer({
            exportDisabled: false,
            setMessage: vi.fn(),
            getSnapshot: createEmptyBoardSnapshot,
        }));

        act(() => result.current.handleResetClick());
        expect(result.current.resetDialogOpen).toBe(true);
        act(() => result.current.handleResetCancel());
        expect(result.current.resetDialogOpen).toBe(false);
        expect(resetBoardDatabaseMock).not.toHaveBeenCalled();
    });

    it("keeps the current page alive and reports an exact reset failure", async () => {
        const setMessage = vi.fn();
        resetBoardDatabaseMock.mockRejectedValueOnce(new Error("Meldrift storage is busy."));
        const { result } = renderHook(() => useBoardTransfer({
            exportDisabled: false,
            setMessage,
            getSnapshot: createEmptyBoardSnapshot,
        }));

        act(() => result.current.handleResetClick());
        await act(async () => result.current.handleResetConfirm());

        expect(resetBoardDatabaseMock).toHaveBeenCalledOnce();
        expect(result.current.resetDialogOpen).toBe(false);
        expect(result.current.resetting).toBe(false);
        expect(setMessage).toHaveBeenLastCalledWith("Meldrift storage is busy.");
    });

    it("locks transfers while the Meldrift-only deletion is pending", async () => {
        resetBoardDatabaseMock.mockReturnValueOnce(new Promise<void>(() => undefined));
        const { result } = renderHook(() => useBoardTransfer({
            exportDisabled: false,
            setMessage: vi.fn(),
            getSnapshot: createEmptyBoardSnapshot,
        }));

        act(() => {
            void result.current.handleResetConfirm();
        });

        await waitFor(() => expect(result.current.resetting).toBe(true));
        expect(resetBoardDatabaseMock).toHaveBeenCalledOnce();
    });
});

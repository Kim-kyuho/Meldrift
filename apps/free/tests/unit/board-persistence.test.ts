import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardLoad } from "@/hooks/useBoardLoad";
import { useBoardPersistance } from "@/hooks/useBoardPersistance";
import { createEmptyBoardSnapshot } from "@/lib/board-state";
import { loadBoardState, replaceBoardState } from "@/lib/browser-db/client";

vi.mock("@/lib/browser-db/client", () => ({
    loadBoardState: vi.fn(),
    replaceBoardState: vi.fn(),
}));

describe("Free board initialization", () => {
    it("does not mount an empty editor or save before the stored board loads", async () => {
        const snapshot = createEmptyBoardSnapshot();
        vi.mocked(loadBoardState).mockResolvedValueOnce(snapshot);
        const { result } = renderHook(() => useBoardLoad());

        expect(result.current.initialSnapshot).toBeNull();
        await waitFor(() => expect(result.current.initialSnapshot).toBe(snapshot));
        expect(replaceBoardState).not.toHaveBeenCalled();
    });

    it("keeps the editor closed when the database cannot load", async () => {
        vi.mocked(loadBoardState).mockRejectedValueOnce(new Error("Storage unavailable"));
        const { result } = renderHook(() => useBoardLoad());

        await waitFor(() => expect(result.current.databaseError).toBe("Storage unavailable"));
        expect(result.current.initialSnapshot).toBeNull();
    });
});

describe("Free board persistence", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(replaceBoardState).mockResolvedValue(undefined);
    });
    afterEach(() => vi.useRealTimers());

    it("cancels pending saves while editing and saves the latest snapshot after editing ends", async () => {
        const first = createEmptyBoardSnapshot();
        const latest = { ...first, board: { ...first.board, title: "Updated" } };
        const setMessage = vi.fn();
        const { rerender } = renderHook(
            ({ snapshot, savePaused }) => useBoardPersistance({ snapshot, savePaused, setMessage }),
            { initialProps: { snapshot: first, savePaused: false } },
        );

        rerender({ snapshot: latest, savePaused: true });
        await act(async () => vi.advanceTimersByTimeAsync(500));
        expect(replaceBoardState).not.toHaveBeenCalled();

        rerender({ snapshot: latest, savePaused: false });
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(replaceBoardState).toHaveBeenCalledExactlyOnceWith(latest);
    });

    it("reports a local save failure", async () => {
        const setMessage = vi.fn();
        vi.mocked(replaceBoardState).mockRejectedValueOnce(new Error("Quota exceeded"));
        renderHook(() => useBoardPersistance({
            snapshot: createEmptyBoardSnapshot(), savePaused: false, setMessage,
        }));

        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(setMessage).toHaveBeenCalledWith("Quota exceeded");
    });

    it("cancels a queued save on unmount", async () => {
        const { unmount } = renderHook(() => useBoardPersistance({
            snapshot: createEmptyBoardSnapshot(), savePaused: false, setMessage: vi.fn(),
        }));
        unmount();
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(replaceBoardState).not.toHaveBeenCalled();
    });
});

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

describe("프리 보드 초기화", () => {
    it("저장된 보드를 불러오기 전에는 빈 에디터를 마운트하거나 저장하지 않는다", async () => {
        const snapshot = createEmptyBoardSnapshot();
        vi.mocked(loadBoardState).mockResolvedValueOnce(snapshot);
        const { result } = renderHook(() => useBoardLoad());

        expect(result.current.initialSnapshot).toBeNull();
        await waitFor(() => expect(result.current.initialSnapshot).toBe(snapshot));
        expect(replaceBoardState).not.toHaveBeenCalled();
    });

    it("데이터베이스 로드에 실패하면 에디터를 닫힌 상태로 유지한다", async () => {
        vi.mocked(loadBoardState).mockRejectedValueOnce(new Error("Storage unavailable"));
        const { result } = renderHook(() => useBoardLoad());

        await waitFor(() => expect(result.current.databaseError).toBe("Storage unavailable"));
        expect(result.current.initialSnapshot).toBeNull();
    });
});

describe("프리 보드 영속 저장", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(replaceBoardState).mockResolvedValue(undefined);
    });
    afterEach(() => vi.useRealTimers());

    it("연속 변경을 최신 스냅샷 하나로 합친다", async () => {
        const first = createEmptyBoardSnapshot();
        const latest = { ...first, board: { ...first.board, title: "Latest" } };
        const setMessage = vi.fn();
        const { rerender } = renderHook(
            ({ snapshot }) => useBoardPersistance({ snapshot, savePaused: false, setMessage }),
            { initialProps: { snapshot: first } },
        );
        await act(async () => vi.advanceTimersByTimeAsync(100));
        rerender({ snapshot: latest });
        await act(async () => vi.advanceTimersByTimeAsync(149));
        expect(replaceBoardState).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(replaceBoardState).toHaveBeenCalledExactlyOnceWith(latest);
    });

    it("편집 중에는 예약된 저장을 취소하고 편집 종료 후 최신 스냅샷을 저장한다", async () => {
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

    it("로컬 저장 실패를 알린다", async () => {
        const setMessage = vi.fn();
        vi.mocked(replaceBoardState).mockRejectedValueOnce(new Error("Quota exceeded"));
        renderHook(() => useBoardPersistance({
            snapshot: createEmptyBoardSnapshot(), savePaused: false, setMessage,
        }));

        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(setMessage).toHaveBeenCalledWith("Quota exceeded");
    });

    it("언마운트 시 예약된 저장을 취소한다", async () => {
        const { unmount } = renderHook(() => useBoardPersistance({
            snapshot: createEmptyBoardSnapshot(), savePaused: false, setMessage: vi.fn(),
        }));
        unmount();
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(replaceBoardState).not.toHaveBeenCalled();
    });
});

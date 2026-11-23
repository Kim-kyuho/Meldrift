import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardLoad } from "@/hooks/useBoardLoad";
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

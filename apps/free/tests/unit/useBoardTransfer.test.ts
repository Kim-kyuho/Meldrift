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

describe("useBoardTransfer 동작", () => {
    beforeEach(() => vi.clearAllMocks());

    it("보드를 변경하지 않고 초기화 확인을 열거나 취소한다", () => {
        const { result, replaceSnapshot } = setup();
        act(() => result.current.handleResetClick());
        expect(result.current.resetDialogOpen).toBe(true);
        act(() => result.current.handleResetCancel());
        expect(result.current.resetDialogOpen).toBe(false);
        expect(replaceSnapshot).not.toHaveBeenCalled();
    });

    it("데이터베이스를 제거하지 않고 실행 취소 가능한 UI 교체로 내용을 초기화한다", async () => {
        const { result, replaceSnapshot } = setup();
        await act(async () => result.current.handleResetConfirm());
        expect(replaceSnapshot).toHaveBeenCalledWith(createEmptyBoardSnapshot());
        expect(resetBoardDatabase).not.toHaveBeenCalled();
        expect(result.current.resetting).toBe(false);
    });

    it("새로고침 없이 가져온 스냅샷을 적용한다", async () => {
        const snapshot = createEmptyBoardSnapshot();
        vi.mocked(importBoardDatabase).mockResolvedValueOnce(snapshot);
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result, replaceSnapshot } = setup();
        await act(async () => result.current.handleImport({ target: {
            files: [{ size: 100, arrayBuffer: async () => new ArrayBuffer(100) }], value: "file",
        } } as never));
        expect(replaceSnapshot).toHaveBeenCalledWith(snapshot);
    });

    it("가져오기에 실패하면 현재 보드를 보존한다", async () => {
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

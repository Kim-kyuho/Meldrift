import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useBoardTransfer } from "@/hooks/useBoardTransfer";
import { createEmptyBoardSnapshot } from "@meldrift/board/board-state";

function setupOptions() {
    return {
        snapshot: { ...createEmptyBoardSnapshot(), board: { boardId: 7, title: "Current board", width: 7680, height: 4320 } },
        canExport: true, canEdit: true, savePaused: false,
        replaceSnapshot: vi.fn(), setMessage: vi.fn(),
        exportSnapshot: vi.fn(async () => new ArrayBuffer(16)),
        readSnapshotFile: vi.fn(async () => createEmptyBoardSnapshot()),
    };
}

const importEvent = () => ({
    target: { files: [{ size: 16, arrayBuffer: async () => new ArrayBuffer(16) }], value: "board.sqlite" },
}) as unknown as ChangeEvent<HTMLInputElement>;

describe("Plus board file operations", () => {
    it("imports cards into the current board while preserving Neon metadata", async () => {
        const options = setupOptions();
        const imported = createEmptyBoardSnapshot();
        imported.memos.push({ id: 1, boardId: 1, content: "Imported", x: 0, y: 0, z: 1,
            width: 300, height: 200, color: "#fff", sortOrder: 1 });
        options.readSnapshotFile.mockResolvedValue(imported);
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result } = renderHook(() => useBoardTransfer(options));
        await act(async () => result.current.handleImport(importEvent()));
        expect(options.replaceSnapshot).toHaveBeenCalledWith({
            ...imported, board: options.snapshot.board,
            memos: [{ ...imported.memos[0], boardId: 7 }],
        });
    });

    it("resets only content and requires confirmation", () => {
        const options = setupOptions();
        const { result } = renderHook(() => useBoardTransfer(options));
        act(() => result.current.handleResetClick());
        expect(result.current.resetDialogOpen).toBe(true);
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
        act(() => result.current.handleResetConfirm());
        expect(options.replaceSnapshot).toHaveBeenCalledWith({ ...createEmptyBoardSnapshot(), board: options.snapshot.board });
    });

    it("blocks mutation handlers without edit permission", async () => {
        const options = { ...setupOptions(), canEdit: false, canExport: false };
        const { result } = renderHook(() => useBoardTransfer(options));
        await act(async () => {
            await result.current.handleExport();
            await result.current.handleImport(importEvent());
            result.current.handleResetConfirm();
        });
        expect(options.exportSnapshot).not.toHaveBeenCalled();
        expect(options.readSnapshotFile).not.toHaveBeenCalled();
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });

    it("does not apply a file if permission is lost while reading it", async () => {
        const options = setupOptions();
        let finish!: (value: ReturnType<typeof createEmptyBoardSnapshot>) => void;
        options.readSnapshotFile.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
        const { result, rerender } = renderHook((props) => useBoardTransfer(props), { initialProps: options });
        let pending!: Promise<void>;
        await act(async () => { pending = result.current.handleImport(importEvent()); });
        rerender({ ...options, canEdit: false });
        await act(async () => { finish(createEmptyBoardSnapshot()); await pending; });
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });

    it("keeps current contents on invalid files or cancelled imports", async () => {
        const options = setupOptions();
        options.readSnapshotFile.mockRejectedValueOnce(new Error("Invalid SQLite"));
        const { result } = renderHook(() => useBoardTransfer(options));
        await act(async () => result.current.handleImport(importEvent()));
        expect(options.setMessage).toHaveBeenCalledWith("Invalid SQLite");
        vi.spyOn(window, "confirm").mockReturnValue(false);
        await act(async () => result.current.handleImport(importEvent()));
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });
});

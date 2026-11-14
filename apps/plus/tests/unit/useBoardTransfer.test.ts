import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useBoardTransfer } from "@/hooks/useBoardTransfer";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";

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

describe("플러스 보드 파일 작업", () => {
    it("Neon 메타데이터를 보존하면서 현재 보드에 카드를 가져온다", async () => {
        const options = setupOptions();
        const imported = createEmptyBoardSnapshot();
        imported.memos.push({ id: 1, syncId: "memo-1", boardId: 1, content: "Imported", x: 0, y: 0, z: 1,
            width: 300, height: 200, color: "#fff", sortOrder: 1 });
        options.readSnapshotFile.mockResolvedValue(imported);
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result } = renderHook(() => useBoardTransfer(options));
        await act(async () => result.current.handleImport(importEvent()));
        expect(options.replaceSnapshot).toHaveBeenCalledWith({
            ...imported, board: options.snapshot.board,
            memos: [{ ...imported.memos[0], boardId: 7, syncId: expect.any(String) }],
        });
    });

    it("가져온 카드에는 새 동기화 식별자를 발급한다", async () => {
        const options = setupOptions();
        const imported = createEmptyBoardSnapshot();
        imported.memos.push({ id: 1, syncId: "memo-1", boardId: 1, content: "Imported", x: 0, y: 0, z: 1,
            width: 300, height: 200, color: "#fff", sortOrder: 1 });
        imported.images.push({ imageId: 1, syncId: "image-1", assetId: "asset-1", boardId: 1, url: "",
            data: new Uint8Array([1, 2, 3]), mimeType: "image/webp", label: "a.webp",
            x: 0, y: 0, z: 1, width: 10, height: 10 });
        options.readSnapshotFile.mockResolvedValue(imported);
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result } = renderHook(() => useBoardTransfer(options));
        await act(async () => result.current.handleImport(importEvent()));

        const [replaced] = options.replaceSnapshot.mock.calls[0];
        expect(replaced.memos[0].syncId).not.toBe("memo-1");
        expect(replaced.images[0].syncId).not.toBe("image-1");
        expect(replaced.images[0].assetId).not.toBe("asset-1");
        expect(replaced.images[0].assetId).not.toBe("");
    });

    it("확인 후에만 보드 내용만 초기화한다", () => {
        const options = setupOptions();
        const { result } = renderHook(() => useBoardTransfer(options));
        act(() => result.current.handleResetClick());
        expect(result.current.resetDialogOpen).toBe(true);
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
        act(() => result.current.handleResetConfirm());
        expect(options.replaceSnapshot).toHaveBeenCalledWith({ ...createEmptyBoardSnapshot(), board: options.snapshot.board });
    });

    it("편집 권한이 없으면 변경 핸들러를 차단한다", async () => {
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

    it("파일을 읽는 중 권한을 잃으면 파일을 적용하지 않는다", async () => {
        const options = setupOptions();
        let finish!: (value: ReturnType<typeof createEmptyBoardSnapshot>) => void;
        options.readSnapshotFile.mockImplementationOnce(() => new Promise((resolve) => {
            finish = resolve;
        }));
        const { result, rerender } = renderHook((props) => useBoardTransfer(props), { initialProps: options });
        let pending!: Promise<void>;
        await act(async () => {
            pending = result.current.handleImport(importEvent());
        });
        rerender({ ...options, canEdit: false });
        await act(async () => {
            finish(createEmptyBoardSnapshot());
            await pending;
        });
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });

    it("잘못된 파일이나 가져오기 취소 시 현재 내용을 유지한다", async () => {
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

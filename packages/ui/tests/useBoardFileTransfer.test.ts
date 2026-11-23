import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@meldrift/board-data/board-state";
import { useBoardFileTransfer } from "../src/features/board/useBoardFileTransfer";

const currentBoard = { boardId: 7, title: "Current board", width: 7680, height: 4320 };

function setupOptions() {
    return {
        file: {
            fileName: vi.fn(() => "board.sqlite"),
            maxImportBytes: 1024,
            exportFile: vi.fn(async () => new ArrayBuffer(16)),
            readFile: vi.fn(async () => createEmptyBoardSnapshot()),
        },
        snapshot: { ...createEmptyBoardSnapshot(), board: currentBoard },
        canEdit: true,
        canExport: true,
        savePaused: false,
        replaceSnapshot: vi.fn(),
        setMessage: vi.fn(),
    };
}

const importEvent = (size = 16) => ({
    target: { files: [{ size, arrayBuffer: async () => new ArrayBuffer(size) }], value: "board.sqlite" },
}) as unknown as ChangeEvent<HTMLInputElement>;

function importedSnapshot(): BoardSnapshot {
    const imported = createEmptyBoardSnapshot();
    imported.memos.push({
        id: 1, syncId: "memo-1", boardId: 1, content: "Imported", x: 0, y: 0, z: 1,
        width: 300, height: 200, color: "#fff", sortOrder: 1,
    });
    return imported;
}

describe("useBoardFileTransfer 동작", () => {
    it("현재 보드 정보를 유지한 채 가져온 카드를 현재 보드에 적용한다", async () => {
        const options = setupOptions();
        const imported = importedSnapshot();
        options.file.readFile.mockResolvedValue(imported);
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => result.current.handleImport(importEvent()));

        expect(options.replaceSnapshot).toHaveBeenCalledWith({
            ...imported,
            board: currentBoard,
            memos: [{ ...imported.memos[0], boardId: 7 }],
        });
        expect(result.current.transferring).toBe(false);
    });

    it("파일을 읽고 검증한 뒤에 확인을 묻는다", async () => {
        const options = setupOptions();
        options.file.readFile.mockRejectedValueOnce(new Error("Invalid SQLite"));
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => result.current.handleImport(importEvent()));

        expect(confirm).not.toHaveBeenCalled();
        expect(options.setMessage).toHaveBeenCalledWith("Invalid SQLite");
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });

    it("가져오기를 취소하면 현재 내용을 유지한다", async () => {
        const options = setupOptions();
        vi.spyOn(window, "confirm").mockReturnValue(false);
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => result.current.handleImport(importEvent()));

        expect(options.file.readFile).toHaveBeenCalled();
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });

    it("크기 상한을 넘는 파일은 읽지 않는다", async () => {
        const options = { ...setupOptions(), file: { ...setupOptions().file, maxImportBytes: 4 * 1024 * 1024 } };
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => result.current.handleImport(importEvent(4 * 1024 * 1024 + 1)));

        expect(options.file.readFile).not.toHaveBeenCalled();
        expect(options.setMessage).toHaveBeenCalledWith("The SQLite save file must be 4 MiB or smaller.");
    });

    it("파일을 읽는 중 권한을 잃으면 적용하지 않는다", async () => {
        const options = setupOptions();
        let finish!: (value: BoardSnapshot) => void;
        options.file.readFile.mockImplementationOnce(() => new Promise((resolve) => {
            finish = resolve;
        }));
        const { result, rerender } = renderHook((props) => useBoardFileTransfer(props), { initialProps: options });
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

    it("편집 권한이 없으면 가져오기와 초기화를 막는다", async () => {
        const options = { ...setupOptions(), canEdit: false };
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => {
            await result.current.handleImport(importEvent());
            result.current.handleResetClick();
            result.current.handleResetConfirm();
        });

        expect(options.file.readFile).not.toHaveBeenCalled();
        expect(result.current.resetDialogOpen).toBe(false);
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });

    it("내보내기 권한이 없으면 파일을 만들지 않는다", async () => {
        const options = { ...setupOptions(), canExport: false };
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => result.current.handleExport());

        expect(options.file.exportFile).not.toHaveBeenCalled();
    });

    it("파일 어댑터가 없으면 반출입을 하지 않는다", async () => {
        const options = { ...setupOptions(), file: undefined };
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => {
            await result.current.handleExport();
            await result.current.handleImport(importEvent());
        });

        expect(options.replaceSnapshot).not.toHaveBeenCalled();
        expect(result.current.transferring).toBe(false);
    });

    it("어댑터가 정한 파일명으로 내려받는다", async () => {
        const options = setupOptions();
        const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        const NativeURL = URL;
        class MockURL extends NativeURL {
            static createObjectURL = vi.fn().mockReturnValue("blob:board");
            static revokeObjectURL = vi.fn();
        }
        vi.stubGlobal("URL", MockURL);
        const { result } = renderHook(() => useBoardFileTransfer(options));

        await act(async () => result.current.handleExport());

        expect(options.file.exportFile).toHaveBeenCalledWith(options.snapshot);
        expect(options.file.fileName).toHaveBeenCalledWith(currentBoard);
        expect(click).toHaveBeenCalledOnce();
        expect(MockURL.revokeObjectURL).toHaveBeenCalledWith("blob:board");
        vi.unstubAllGlobals();
    });

    it("확인한 뒤에만 보드 정보를 남기고 내용을 비운다", () => {
        const options = setupOptions();
        const { result } = renderHook(() => useBoardFileTransfer(options));

        act(() => result.current.handleResetClick());
        expect(result.current.resetDialogOpen).toBe(true);
        expect(options.replaceSnapshot).not.toHaveBeenCalled();

        act(() => result.current.handleResetConfirm());
        expect(result.current.resetDialogOpen).toBe(false);
        expect(options.replaceSnapshot).toHaveBeenCalledWith({ ...createEmptyBoardSnapshot(), board: currentBoard });
    });

    it("초기화 확인을 취소하면 아무것도 바꾸지 않는다", () => {
        const options = setupOptions();
        const { result } = renderHook(() => useBoardFileTransfer(options));

        act(() => result.current.handleResetClick());
        act(() => result.current.handleResetCancel());

        expect(result.current.resetDialogOpen).toBe(false);
        expect(options.replaceSnapshot).not.toHaveBeenCalled();
    });
});

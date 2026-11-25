import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@meldrift/board-data/board-state";
import BoardMenu from "../src/features/board/BoardMenu";
import BoardControls from "../src/features/board/BoardControls";
import type { BoardStorage } from "../src/features/board/board-storage";

type ControlsProps = ComponentProps<typeof BoardControls>;

function createStorage(overrides: Partial<BoardStorage> = {}): BoardStorage {
    return {
        save: vi.fn(),
        file: {
            fileName: () => "board.sqlite",
            maxImportBytes: 1024,
            exportFile: vi.fn(async () => new ArrayBuffer(16)),
            readFile: vi.fn(async () => createEmptyBoardSnapshot()),
        },
        ...overrides,
    };
}

function createProps(overrides: Partial<ControlsProps> = {}): ControlsProps {
    return {
        storage: createStorage(),
        renderMenu: (menu) => <BoardMenu {...menu} brand="Meldrift" />,
        snapshot: createEmptyBoardSnapshot(),
        savePaused: false,
        canSave: true,
        canEdit: true,
        canExport: true,
        menuOpen: true,
        setMenuOpen: vi.fn(),
        reorderOpen: false,
        onReorder: vi.fn(),
        onCompileMarkdown: vi.fn(),
        onAbout: vi.fn(),
        replaceSnapshot: vi.fn(),
        setMessage: vi.fn(),
        ...overrides,
    };
}

const changed = (snapshot: BoardSnapshot, title: string) => ({ ...snapshot, board: { ...snapshot.board, title } });

describe("BoardControls 저장 예약", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("연속 변경을 최신 스냅샷 하나로 합쳐 150ms 뒤에 저장한다", async () => {
        const props = createProps();
        const { rerender } = render(<BoardControls {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(100));

        const latest = changed(props.snapshot, "Latest");
        rerender(<BoardControls {...props} snapshot={latest} />);
        await act(async () => vi.advanceTimersByTimeAsync(149));
        expect(props.storage?.save).not.toHaveBeenCalledWith(latest);

        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(props.storage?.save).toHaveBeenLastCalledWith(latest);
    });

    it("저장소가 초기 저장을 건너뛰게 하면 처음 받은 스냅샷은 저장하지 않는다", async () => {
        const props = createProps({ storage: createStorage({ skipInitialSave: true }) });
        render(<BoardControls {...props} />);

        await act(async () => vi.advanceTimersByTimeAsync(150));

        expect(props.storage?.save).not.toHaveBeenCalled();
    });

    it.each([
        ["편집 중", { savePaused: true }],
        ["저장 권한 없음", { canSave: false }],
    ])("%s에는 예약된 저장을 멈추고 풀리면 최신 스냅샷을 저장한다", async (_reason, paused) => {
        const props = createProps({ storage: createStorage({ skipInitialSave: true }) });
        const { rerender } = render(<BoardControls {...props} />);
        const latest = changed(props.snapshot, "Updated");

        rerender(<BoardControls {...props} {...paused} snapshot={latest} />);
        await act(async () => vi.advanceTimersByTimeAsync(500));
        expect(props.storage?.save).not.toHaveBeenCalled();

        rerender(<BoardControls {...props} snapshot={latest} />);
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(props.storage?.save).toHaveBeenCalledExactlyOnceWith(latest);
    });

    it("보드 전체를 바꾼 뒤에는 예약을 기다리지 않고 바로 저장한다", async () => {
        const props = createProps({ storage: createStorage({ skipInitialSave: true }) });
        const { rerender } = render(<BoardControls {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        const [replaced] = vi.mocked(props.replaceSnapshot).mock.calls[0];
        rerender(<BoardControls {...props} snapshot={replaced} />);
        await act(async () => vi.advanceTimersByTimeAsync(0));

        expect(props.storage?.save).toHaveBeenCalledExactlyOnceWith(replaced);

        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(props.storage?.save).toHaveBeenCalledOnce();
    });

    it("저장 실패를 메시지로 알린다", async () => {
        const save = vi.fn().mockRejectedValueOnce(new Error("Quota exceeded"));
        const props = createProps({ storage: createStorage({ save }) });
        render(<BoardControls {...props} />);

        await act(async () => vi.advanceTimersByTimeAsync(150));

        expect(props.setMessage).toHaveBeenCalledWith("Quota exceeded");
    });

    it("언마운트하면 예약된 저장을 취소한다", async () => {
        const props = createProps();
        const { unmount } = render(<BoardControls {...props} />);

        unmount();
        await act(async () => vi.advanceTimersByTimeAsync(150));

        expect(props.storage?.save).not.toHaveBeenCalled();
    });
});

describe("BoardControls 메뉴 항목", () => {
    it("편집 권한이 있으면 파일 항목을 모두 연다", () => {
        render(<BoardControls {...createProps()} />);

        for (const name of ["Export", "Import", "Reset"]) {
            expect(screen.getByRole("button", { name })).toBeEnabled();
        }
    });

    it("내보내기 권한만 있으면 가져오기와 초기화를 막는다", () => {
        render(<BoardControls {...createProps({ canEdit: false })} />);

        expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });

    it("권한이 없으면 파일 항목을 모두 막는다", () => {
        render(<BoardControls {...createProps({ canEdit: false, canExport: false })} />);

        for (const name of ["Export", "Import", "Reset"]) {
            expect(screen.getByRole("button", { name })).toBeDisabled();
        }
        expect(screen.getByRole("button", { name: "Compile to Markdown" })).toBeEnabled();
    });

    it("저장소가 없으면 파일 항목을 막고 편집 중 안내도 띄우지 않는다", () => {
        render(<BoardControls {...createProps({ storage: undefined, savePaused: true })} />);

        for (const name of ["Export", "Import", "Reset"]) {
            expect(screen.getByRole("button", { name })).toBeDisabled();
        }
        expect(screen.queryByText("Finish editing before exporting.")).not.toBeInTheDocument();
    });

    it("편집 중에는 파일 항목을 막고 안내를 띄운다", () => {
        render(<BoardControls {...createProps({ savePaused: true })} />);

        expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
        expect(screen.getByText("Finish editing before exporting.")).toBeVisible();
    });

    it("내보내기 전에 대기 중인 저장을 먼저 끝낸다", async () => {
        const order: string[] = [];
        const storage = createStorage({ skipInitialSave: true });
        vi.mocked(storage.save).mockImplementation(() => {
            order.push("save");
        });
        vi.mocked(storage.file!.exportFile).mockImplementation(async () => {
            order.push("export");
            return new ArrayBuffer(16);
        });
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        const NativeURL = URL;
        class MockURL extends NativeURL {
            static createObjectURL = vi.fn().mockReturnValue("blob:board");
            static revokeObjectURL = vi.fn();
        }
        vi.stubGlobal("URL", MockURL);
        const props = createProps({ storage });
        const { rerender } = render(<BoardControls {...props} />);
        const latest = changed(props.snapshot, "Exported");
        rerender(<BoardControls {...props} snapshot={latest} />);

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Export" }));
        });

        expect(storage.save).toHaveBeenCalledExactlyOnceWith(latest);
        expect(order).toEqual(["save", "export"]);
        vi.unstubAllGlobals();
    });

    it("초기화는 확인창을 거친 뒤 보드 내용을 비운다", () => {
        const props = createProps();
        render(<BoardControls {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(props.setMenuOpen).toHaveBeenCalledWith(false);
        expect(screen.getByRole("heading", { name: "Reset this board?" })).toBeVisible();
        expect(props.replaceSnapshot).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        expect(props.replaceSnapshot).toHaveBeenCalledWith({
            ...createEmptyBoardSnapshot(),
            board: props.snapshot.board,
        });
    });

    it("단일 Import 입력에서 Markdown 파일을 선택하면 SQLite 로더 대신 Markdown 임포터로 분기한다", async () => {
        const storage = createStorage();
        const props = createProps({ storage });
        render(<BoardControls {...props} />);

        const bytes = new TextEncoder().encode("# Imported Title\n\nBody text");
        const mdFile = new File([bytes], "notes.md", { type: "text/markdown" });
        Object.defineProperty(mdFile, "arrayBuffer", { value: async () => bytes.slice().buffer });
        Object.defineProperty(mdFile, "slice", {
            value: (start = 0, end = bytes.byteLength) => ({
                arrayBuffer: async () => bytes.slice(start, end).buffer,
            }),
        });

        const input = screen.getByLabelText("Import board database");
        await act(async () => {
            fireEvent.change(input, { target: { files: [mdFile] } });
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(storage.file!.readFile).not.toHaveBeenCalled();
        expect(props.replaceSnapshot).toHaveBeenCalledOnce();
        const [replaced] = vi.mocked(props.replaceSnapshot).mock.calls[0];
        expect(replaced.memos).toHaveLength(1);
        expect(replaced.memos[0].content).toContain("Imported Title");
    });
});

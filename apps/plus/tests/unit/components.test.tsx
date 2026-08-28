import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "@meldrift/ui/ConfirmDialog";
import CreateBoardModal from "@/components/CreateBoardModal";
import PressableButton from "@meldrift/ui/PressableButton";
import RenameBoardModal from "@/components/RenameBoardModal";
import AboutModal from "@/components/AboutModal";
import BoardMenu from "@/components/BoardMenu";
import BoardNavigator from "@meldrift/ui/BoardNavigator";
import BoardToolBar from "@/components/BoardToolBar";

describe("PressableButton", () => {
    it("applies and clears touch feedback while forwarding callbacks", () => {
        const onTouchStart = vi.fn();
        const onTouchEnd = vi.fn();
        render(<PressableButton onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>Action</PressableButton>);
        const button = screen.getByRole("button", { name: "Action" });

        fireEvent.touchStart(button);
        expect(button).toHaveClass("scale-[0.96]");
        expect(onTouchStart).toHaveBeenCalledOnce();

        fireEvent.touchEnd(button);
        expect(button).not.toHaveClass("scale-[0.96]");
        expect(onTouchEnd).toHaveBeenCalledOnce();
    });
});

describe("ConfirmDialog", () => {
    it("renders through a portal and dispatches confirm and cancel", () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(<ConfirmDialog message="Delete card?" onConfirm={onConfirm} onCancel={onCancel} />);

        expect(screen.getByText("Delete card?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        fireEvent.click(screen.getByRole("button", { name: "No" }));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledOnce();
    });
});

describe("BoardMenu and AboutModal", () => {
    it("renders the Compile and About icons", () => {
        render(
            <BoardMenu
                menuOpen
                currentBoard={{ title: "Meldrift" }}
                setMenuOpen={vi.fn()}
                setSignInOpen={vi.fn()}
                setSignUpOpen={vi.fn()}
                currentUser={null}
                onSignOut={vi.fn()}
                onCompileMarkdown={vi.fn()}
            reorderOpen={false}
            onReorder={vi.fn()}
                onAbout={vi.fn()}
            />
        );

        expect(screen.getByRole("button", { name: "Compile to Markdown" }).querySelector(".lucide-file-text")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About" }).querySelector(".lucide-info")).toBeInTheDocument();
    });

    it("renders contact links and closes About with Escape", () => {
        const onClose = vi.fn();
        render(<AboutModal onClose={onClose} />);

        expect(screen.getByRole("dialog", { name: "About" })).toBeVisible();
        expect(screen.getByRole("link", { name: /Email:/ })).toHaveAttribute("href", "mailto:kgh9002@icloud.com");
        expect(screen.getByRole("link", { name: /GitHub:/ })).toHaveAttribute("href", "https://github.com/Kim-kyuho/");
        expect(screen.getByRole("link", { name: /Blog:/ })).toHaveAttribute("href", "https://kyulog.vercel.app");

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });
});

describe("BoardNavigator", () => {
    it("moves with arrows and focuses the entered memo number immediately", () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        const onMemoNumberChange = vi.fn();

        render(
            <BoardNavigator
                currentMemoNumber={2}
                memoCount={5}
                onPrev={onPrev}
                onNext={onNext}
                onMemoNumberChange={onMemoNumberChange}
            />
        );

        expect(screen.getByText("/ 5")).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "Previous memo" }));
        fireEvent.click(screen.getByRole("button", { name: "Next memo" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Memo number" }), {
            target: { value: "4" },
        });

        expect(onPrev).toHaveBeenCalledOnce();
        expect(onNext).toHaveBeenCalledOnce();
        expect(onMemoNumberChange).toHaveBeenCalledWith(4);
    });
});

describe("BoardToolBar panel feedback", () => {
    it("marks the open search or navigator button with the drawing tool active color", () => {
        const { rerender } = render(
            <BoardToolBar
                cardEditing={false}
                drawingMode={false}
                searchBarOpen
                boardNavigatorOpen={false}
                boardZoom={1}
                setBoardZoom={vi.fn()}
                setMenuOpen={vi.fn()}
                setSearchBarOpen={vi.fn()}
                setBoardNavigatorOpen={vi.fn()}
                onMemoCreateClick={vi.fn()}
                onImageUploadClick={vi.fn()}
                onMermaidCreateClick={vi.fn()}
                onTableCreateClick={vi.fn()}
                onDrawingToggleClick={vi.fn()}
            />
        );

        expect(screen.getByRole("button", { name: "Search memos" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Search memos" }).querySelector("svg")).toHaveStyle({ color: "#ec4899" });

        rerender(
            <BoardToolBar
                cardEditing={false}
                drawingMode={false}
                searchBarOpen={false}
                boardNavigatorOpen
                boardZoom={1}
                setBoardZoom={vi.fn()}
                setMenuOpen={vi.fn()}
                setSearchBarOpen={vi.fn()}
                setBoardNavigatorOpen={vi.fn()}
                onMemoCreateClick={vi.fn()}
                onImageUploadClick={vi.fn()}
                onMermaidCreateClick={vi.fn()}
                onTableCreateClick={vi.fn()}
                onDrawingToggleClick={vi.fn()}
            />
        );

        expect(screen.getByRole("button", { name: "Open memo navigator" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Open memo navigator" }).querySelector("svg")).toHaveStyle({ color: "#ec4899" });
    });
});

describe("board modals", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("creates a trimmed board with the selected dimensions", async () => {
        const onCreated = vi.fn();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ ok: true, board: { boardId: 12 } }),
        }));
        render(<CreateBoardModal ownerId="owner" onClose={vi.fn()} onCreated={onCreated} />);

        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  Project  " } });
        fireEvent.change(screen.getByLabelText("Board size"), { target: { value: "1920 x 1080" } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));

        await waitFor(() => expect(onCreated).toHaveBeenCalledWith(12));
        expect(fetch).toHaveBeenCalledWith("/api/boards", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ title: "Project", width: 1920, height: 1080, ownerId: "owner" }),
        }));
    });

    it("shows create and rename API errors", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ ok: false, message: "Rejected" }),
        }));
        const create = render(<CreateBoardModal ownerId={null} onClose={vi.fn()} onCreated={vi.fn()} />);
        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Board" } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        expect(await screen.findByText("Rejected")).toBeInTheDocument();
        create.unmount();

        render(<RenameBoardModal boardId={5} title="Old" onClose={vi.fn()} onRenamed={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "Rename" }));
        expect(await screen.findByText("Rejected")).toBeInTheDocument();
    });

    it("renames a board and returns the server result", async () => {
        const onRenamed = vi.fn();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ ok: true, board: { boardId: 5, title: "New title" } }),
        }));
        render(<RenameBoardModal boardId={5} title="Old" onClose={vi.fn()} onRenamed={onRenamed} />);

        fireEvent.change(screen.getByLabelText("Title"), { target: { value: "  New title  " } });
        fireEvent.click(screen.getByRole("button", { name: "Rename" }));

        await waitFor(() => expect(onRenamed).toHaveBeenCalledWith(5, "New title"));
        expect(fetch).toHaveBeenCalledWith("/api/boards/5", expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ boardId: 5, title: "New title" }),
        }));
    });
});

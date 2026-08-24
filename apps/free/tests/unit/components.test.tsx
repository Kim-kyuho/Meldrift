import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoardMenu from "@/components/BoardMenu";
import AboutModal from "@/components/AboutModal";
import BoardMessage from "@/components/BoardMessage";
import BoardNavigator from "@/components/BoardNavigator";
import BoardToolBar from "@/components/BoardToolBar";
import ConfirmDialog from "@/components/ConfirmDialog";
import DrawingToolBar from "@/components/DrawingToolBar";
import PressableButton from "@/components/PressableButton";

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
        render(<ConfirmDialog title="Reset Meldrift Free Edition?" message="Once deleted, your board data cannot be recovered." onConfirm={onConfirm} onCancel={onCancel} />);

        expect(screen.getByRole("heading", { name: "Reset Meldrift Free Edition?" })).toBeInTheDocument();
        expect(screen.getByText("Once deleted, your board data cannot be recovered.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        fireEvent.click(screen.getByRole("button", { name: "No" }));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledOnce();
    });
});

describe("Free Edition board controls", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("disables Export while a card is being edited", () => {
        const onReset = vi.fn();
        const setMenuOpen = vi.fn();
        render(<BoardMenu
            menuOpen
            setMenuOpen={setMenuOpen}
            exportDisabled
            transferring={false}
            resetting={false}
            onExport={vi.fn()}
            onImport={vi.fn()}
            onCompileMarkdown={vi.fn()}
            onReset={onReset}
            onAbout={vi.fn()}
        />);

        const meldriftHome = screen.getByRole("link", { name: "Meldrift home" });
        expect(meldriftHome).toContainElement(screen.getByAltText("meldrift"));
        expect(meldriftHome.querySelector('img[alt=""]')).toBeInTheDocument();
        expect(screen.getByText("Free Edition")).toBeVisible();
        expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Export" }).querySelector(".lucide-download")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Import" }).querySelector(".lucide-folder-open")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Compile to Markdown" }).querySelector(".lucide-file-text")).toBeInTheDocument();
        const resetButton = screen.getByRole("button", { name: "Reset" });
        expect(resetButton.querySelector(".lucide-shredder")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About" }).querySelector(".lucide-info")).toBeInTheDocument();
        expect(screen.getByText("Finish editing before exporting.")).toBeVisible();

        const compileButton = screen.getByRole("button", { name: "Compile to Markdown" });
        expect(compileButton.compareDocumentPosition(resetButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(resetButton);
        expect(setMenuOpen).toHaveBeenCalledWith(false);
        expect(onReset).toHaveBeenCalledOnce();
    });

    it("shows contact links in the About modal and closes with Escape", () => {
        const onClose = vi.fn();
        render(<AboutModal onClose={onClose} />);

        expect(screen.getByRole("dialog", { name: "About" })).toBeVisible();
        expect(screen.getByRole("link", { name: /Email:/ })).toHaveAttribute("href", "mailto:kgh9002@icloud.com");
        expect(screen.getByRole("link", { name: /GitHub:/ })).toHaveAttribute("href", "https://github.com/Kim-kyuho/");
        expect(screen.getByRole("link", { name: /Blog:/ })).toHaveAttribute("href", "https://kyulog.vercel.app");

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("keeps drawing controls focused on drawing and erasing without a duplicate pan tool", () => {
        const portalTarget = document.createElement("div");
        portalTarget.id = "card-tool-portal";
        document.body.appendChild(portalTarget);

        render(
            <DrawingToolBar
                drawingTool="draw"
                penColor="#1f2937"
                penWidth={4}
                onChangeColor={vi.fn()}
                onChangeWidth={vi.fn()}
                onToggleErase={vi.fn()}
                onUndo={vi.fn()}
            />,
        );

        expect(screen.getByRole("button", { name: "Erase" })).toBeVisible();
        expect(screen.queryByRole("button", { name: "Pan the board" })).not.toBeInTheDocument();
        portalTarget.remove();
    });
});

describe("Beta board toolbar layout", () => {
    const renderToolbar = (cardEditing: boolean, drawingMode: boolean) => render(
        <BoardToolBar
            cardEditing={cardEditing}
            drawingMode={drawingMode}
            searchBarOpen={false}
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

    it("keeps drawing start and finish in the separate lower-left control", () => {
        const { rerender } = renderToolbar(false, false);
        const startButton = screen.getByRole("button", { name: "Start drawing" });
        expect(startButton.parentElement).toHaveClass("bottom-10", "left-10");
        expect(startButton).toHaveClass("text-neutral-900");

        rerender(
            <BoardToolBar
                cardEditing
                drawingMode
                searchBarOpen={false}
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

        const finishButton = screen.getByRole("button", { name: "Finish drawing" });
        expect(finishButton).toBeVisible();
        expect(finishButton).toHaveClass("text-neutral-900");
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
        expect(screen.getByRole("textbox", { name: "Memo number" })).toHaveValue("2");
        fireEvent.click(screen.getByRole("button", { name: "Previous memo" }));
        fireEvent.click(screen.getByRole("button", { name: "Next memo" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Memo number" }), {
            target: { value: "memo 4" },
        });

        expect(onPrev).toHaveBeenCalledOnce();
        expect(onNext).toHaveBeenCalledOnce();
        expect(onMemoNumberChange).toHaveBeenCalledWith(4);
        expect(screen.getByRole("textbox", { name: "Memo number" })).toHaveValue("4");
    });
});

describe("BoardToolBar panel controls", () => {
    const toolbarProps = {
        cardEditing: false,
        drawingMode: false,
        boardZoom: 1,
        setBoardZoom: vi.fn(),
        setMenuOpen: vi.fn(),
        setSearchBarOpen: vi.fn(),
        setBoardNavigatorOpen: vi.fn(),
        onMemoCreateClick: vi.fn(),
        onImageUploadClick: vi.fn(),
        onMermaidCreateClick: vi.fn(),
        onTableCreateClick: vi.fn(),
        onDrawingToggleClick: vi.fn(),
    };

    it("marks the open search or navigator button with the active color", () => {
        const { rerender } = render(
            <BoardToolBar
                {...toolbarProps}
                searchBarOpen
                boardNavigatorOpen={false}
            />
        );

        const searchButton = screen.getByRole("button", { name: "Search memos" });
        expect(searchButton).toHaveAttribute("aria-pressed", "true");
        expect(searchButton.querySelector("svg")).toHaveStyle({ color: "#ec4899" });

        rerender(
            <BoardToolBar
                {...toolbarProps}
                searchBarOpen={false}
                boardNavigatorOpen
            />
        );

        const navigatorButton = screen.getByRole("button", { name: "Open memo navigator" });
        expect(navigatorButton).toHaveAttribute("aria-pressed", "true");
        expect(navigatorButton.querySelector("svg")).toHaveStyle({ color: "#ec4899" });
    });

    it("closes the opposite panel before toggling search or navigation", () => {
        const setSearchBarOpen = vi.fn();
        const setBoardNavigatorOpen = vi.fn();
        render(
            <BoardToolBar
                {...toolbarProps}
                searchBarOpen={false}
                boardNavigatorOpen={false}
                setSearchBarOpen={setSearchBarOpen}
                setBoardNavigatorOpen={setBoardNavigatorOpen}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Open memo navigator" }));
        expect(setSearchBarOpen).toHaveBeenCalledWith(false);
        expect(setBoardNavigatorOpen).toHaveBeenCalledWith(expect.any(Function));

        fireEvent.click(screen.getByRole("button", { name: "Search memos" }));
        expect(setBoardNavigatorOpen).toHaveBeenCalledWith(false);
        expect(setSearchBarOpen).toHaveBeenCalledWith(expect.any(Function));
    });
});

describe("BoardMessage", () => {
    afterEach(() => vi.useRealTimers());

    it("dismisses a visible message after 3.5 seconds", () => {
        vi.useFakeTimers();
        const onDismiss = vi.fn();
        render(<BoardMessage type="board" message="The board could not be saved." onDismiss={onDismiss} />);

        act(() => vi.advanceTimersByTime(3499));
        expect(onDismiss).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});

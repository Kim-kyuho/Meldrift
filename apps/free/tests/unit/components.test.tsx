import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoardMenu from "@/components/BoardMenu";
import AboutModal from "@meldrift/ui/AboutModal";
import BoardNavigator from "@meldrift/ui/BoardNavigator";
import BoardToolBar from "@meldrift/ui/BoardToolBar";
import ConfirmDialog from "@meldrift/ui/ConfirmDialog";
import DrawingToolBar from "@meldrift/ui/DrawingToolBar";
import PressableButton from "@meldrift/ui/PressableButton";

describe("PressableButton 동작", () => {
    it("콜백을 전달하면서 터치 피드백을 적용하고 해제한다", () => {
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

describe("ConfirmDialog 동작", () => {
    it("포탈로 렌더링하고 확인·취소 동작을 전달한다", () => {
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

describe("프리 보드 컨트롤", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("카드 편집 중에는 내보내기를 비활성화한다", () => {
        const onReset = vi.fn();
        const setMenuOpen = vi.fn();
        render(<BoardMenu
            menuOpen
            setMenuOpen={setMenuOpen}
            exportDisabled
            transferring={false}
            resetting={false}
            reorderOpen={false}
            onReorder={vi.fn()}
            onExport={vi.fn()}
            onImport={vi.fn()}
            onCompileMarkdown={vi.fn()}
            onReset={onReset}
            onAbout={vi.fn()}
        />);

        const meldriftHome = screen.getByRole("link", { name: "Meldrift home" });
        expect(meldriftHome).toContainElement(screen.getByAltText("meldrift"));
        expect(meldriftHome.querySelector('img[alt=""]')).toBeInTheDocument();
        expect(screen.getByText("Free Board")).toBeVisible();
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

    it("앱 정보 모달에 연락처 링크를 표시하고 Escape 키로 닫는다", () => {
        const onClose = vi.fn();
        render(<AboutModal onClose={onClose} />);

        expect(screen.getByRole("dialog", { name: "About" })).toBeVisible();
        expect(screen.getByRole("link", { name: /Email:/ })).toHaveAttribute("href", "mailto:kgh9002@icloud.com");
        expect(screen.getByRole("link", { name: /GitHub:/ })).toHaveAttribute("href", "https://github.com/Kim-kyuho/");
        expect(screen.getByRole("link", { name: /Blog:/ })).toHaveAttribute("href", "https://kyulog.vercel.app");

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("중복 패닝 도구 없이 드로잉·지우개 컨트롤만 제공한다", () => {
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

describe("베타 보드 툴바 배치", () => {
    const renderToolbar = (cardEditing: boolean, drawingMode: boolean) => render(
        <BoardToolBar
            cardEditing={cardEditing}
            drawingMode={drawingMode}
            selectionMode={false}
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
            onSelectionToggleClick={vi.fn()}
        />
    );

    it("드로잉 시작·종료 컨트롤을 왼쪽 아래 별도 영역에 유지한다", () => {
        const { rerender } = renderToolbar(false, false);
        const startButton = screen.getByRole("button", { name: "Start drawing" });
        expect(startButton.parentElement).toHaveClass("bottom-10", "left-10");
        expect(startButton).toHaveClass("text-neutral-900");

        rerender(
            <BoardToolBar
                cardEditing
                drawingMode
                selectionMode={false}
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
                onSelectionToggleClick={vi.fn()}
            />
        );

        const finishButton = screen.getByRole("button", { name: "Finish drawing" });
        expect(finishButton).toBeVisible();
        expect(finishButton).toHaveClass("text-neutral-900");
    });
});

describe("BoardNavigator 동작", () => {
    it("화살표로 이동하고 입력한 메모 번호에 즉시 초점을 맞춘다", () => {
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

describe("보드 툴바 패널 제어", () => {
    const toolbarProps = {
        cardEditing: false,
        drawingMode: false,
        selectionMode: false,
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
        onSelectionToggleClick: vi.fn(),
    };

    it("열린 검색·탐색 패널의 버튼을 활성 색상으로 표시한다", () => {
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

    it("검색·탐색 패널을 전환하기 전에 반대쪽 패널을 닫는다", () => {
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

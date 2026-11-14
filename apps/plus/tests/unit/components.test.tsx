import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "@meldrift/ui/ConfirmDialog";
import CreateBoardModal from "@/components/CreateBoardModal";
import PressableButton from "@meldrift/ui/PressableButton";
import RenameBoardModal from "@/components/RenameBoardModal";
import AboutModal from "@/components/AboutModal";
import BoardMenu from "@/components/BoardMenu";
import BoardNavigator from "@meldrift/ui/BoardNavigator";
import BoardToolBar from "@meldrift/ui/BoardToolBar";

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
        render(<ConfirmDialog message="Delete card?" onConfirm={onConfirm} onCancel={onCancel} />);

        expect(screen.getByText("Delete card?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
        fireEvent.click(screen.getByRole("button", { name: "No" }));
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledOnce();
    });
});

describe("보드 메뉴와 앱 정보 모달", () => {
    it("컴파일·앱 정보 아이콘을 렌더링한다", () => {
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

    it("연락처 링크를 표시하고 Escape 키로 앱 정보 창을 닫는다", () => {
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

describe("보드 툴바 패널 피드백", () => {
    it("열린 검색·탐색 패널 버튼을 드로잉 도구의 활성 색상으로 표시한다", () => {
        const { rerender } = render(
            <BoardToolBar
                cardEditing={false}
                drawingMode={false}
                selectionMode={false}
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
                onSelectionToggleClick={vi.fn()}
            />
        );

        expect(screen.getByRole("button", { name: "Search memos" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Search memos" }).querySelector("svg")).toHaveStyle({ color: "#ec4899" });

        rerender(
            <BoardToolBar
                cardEditing={false}
                drawingMode={false}
                selectionMode={false}
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
                onSelectionToggleClick={vi.fn()}
            />
        );

        expect(screen.getByRole("button", { name: "Open memo navigator" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Open memo navigator" }).querySelector("svg")).toHaveStyle({ color: "#ec4899" });
    });
});

describe("보드 모달", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("공백을 정리한 제목과 선택한 크기로 보드를 생성한다", async () => {
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

    it("생성·이름 변경 API 오류를 표시한다", async () => {
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

    it("보드 이름을 변경하고 서버 결과를 반환한다", async () => {
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

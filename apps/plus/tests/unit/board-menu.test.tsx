import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardMenu from "@/components/BoardMenu";

function boardActions() {
    return {
        reorderOpen: false,
        exportDisabled: false,
        exportPaused: false,
        importDisabled: false,
        resetDisabled: false,
        onReorder: vi.fn(),
        onExport: vi.fn(),
        onImport: vi.fn(),
        onCompileMarkdown: vi.fn(),
        onReset: vi.fn(),
    };
}

function props() {
    return {
        menuOpen: true, title: "Board title", setMenuOpen: vi.fn(),
        setSignInOpen: vi.fn(), setSignUpOpen: vi.fn(), onSignOut: vi.fn(), onAbout: vi.fn(),
        boardActions: boardActions(),
    };
}

describe("플러스 공통 보드 메뉴", () => {
    it("로그인 전에는 로그인·가입 항목을 보여 주고 누르면 메뉴를 닫는다", () => {
        const actions = props();
        render(<BoardMenu {...actions} currentUser={null} />);

        fireEvent.click(screen.getByRole("button", { name: "Sign-in" }));
        expect(actions.setMenuOpen).toHaveBeenCalledWith(false);
        expect(actions.setSignInOpen).toHaveBeenCalledWith(true);
        fireEvent.click(screen.getByRole("button", { name: "Sign-up" }));
        expect(actions.setSignUpOpen).toHaveBeenCalledWith(true);
    });

    it("보드 화면에서는 공통 에디터가 계산한 파일 항목 상태를 그대로 쓴다", () => {
        const actions = { ...props(), boardActions: { ...boardActions(), importDisabled: true, resetDisabled: true } };
        render(<BoardMenu {...actions} currentUser={{ email: "reader@test.com", role: "user", isApproved: false }} />);

        expect(screen.getByText("Board title")).toBeVisible();
        expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });

    it("로그인하면 파일 항목과 로그아웃 항목을 쓸 수 있다", () => {
        const actions = props();
        render(<BoardMenu {...actions} currentUser={{ email: "editor@test.com", role: "user", isApproved: true }} />);

        fireEvent.click(screen.getByRole("button", { name: "Import" }));
        expect(actions.boardActions.onImport).toHaveBeenCalledOnce();
        expect(actions.setMenuOpen).toHaveBeenCalledWith(false);
        expect(screen.queryByRole("button", { name: "Sign-in" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Sign-out" }));
        expect(actions.onSignOut).toHaveBeenCalledOnce();
    });

    it("보드 목록에서는 보드 전용 기능을 숨긴다", () => {
        render(<BoardMenu {...props()} title={undefined} boardActions={undefined} currentUser={null} />);

        expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
        expect(screen.getByText("Board List")).toBeVisible();
        expect(screen.getByRole("button", { name: "About" })).toBeEnabled();
    });
});

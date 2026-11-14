import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardMenu from "@/components/BoardMenu";

function props() {
    return {
        menuOpen: true, currentBoard: { title: "Board title" }, setMenuOpen: vi.fn(),
        setSignInOpen: vi.fn(), setSignUpOpen: vi.fn(), onSignOut: vi.fn(), onAbout: vi.fn(),
        transfer: {
            exportDisabled: false, mutationDisabled: false, transferring: false, resetting: false,
            onExport: vi.fn(), onImport: vi.fn(), onReset: vi.fn(),
        },
    };
}

describe("플러스 공통 보드 메뉴", () => {
    it("프리 보드 기능을 표시하되 로그인 전에는 파일 반출입을 비활성화한다", () => {
        const actions = props();
        render(<BoardMenu {...actions} currentUser={null} />);
        for (const name of ["Export", "Import", "Reset"]) {
            expect(screen.getByRole("button", { name })).toBeDisabled();
        }
        expect(screen.getByRole("button", { name: "Compile to Markdown" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Sign-in" }));
        expect(actions.setMenuOpen).toHaveBeenCalledWith(false);
        expect(actions.setSignInOpen).toHaveBeenCalledWith(true);
        fireEvent.click(screen.getByRole("button", { name: "Sign-up" }));
        expect(actions.setSignUpOpen).toHaveBeenCalledWith(true);
    });

    it("승인된 편집자에게 파일 반출입을 허용하고 로그아웃 항목을 표시한다", () => {
        const actions = props();
        render(<BoardMenu {...actions} currentUser={{ email: "editor@test.com", role: "user", isApproved: true }} />);
        for (const name of ["Export", "Import", "Reset"]) {
            expect(screen.getByRole("button", { name })).toBeEnabled();
        }
        fireEvent.click(screen.getByRole("button", { name: "Import" }));
        expect(actions.transfer.onImport).toHaveBeenCalledOnce();
        expect(actions.setMenuOpen).toHaveBeenCalledWith(false);
        expect(screen.queryByRole("button", { name: "Sign-in" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Sign-out" }));
        expect(actions.onSignOut).toHaveBeenCalledOnce();
    });

    it("로그인했어도 승인되지 않은 사용자에게는 쓰기 권한을 주지 않는다", () => {
        render(<BoardMenu {...props()} currentUser={{ email: "reader@test.com", role: "user", isApproved: false }} />);
        expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });

    it("보드 목록에서는 보드 전용 기능을 숨긴다", () => {
        render(<BoardMenu {...props()} currentBoard={undefined} currentUser={null} />);
        expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About" })).toBeEnabled();
    });
});

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

describe("Plus shared board menu", () => {
    it("shows the Free actions but disables transfers before sign-in", () => {
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

    it("enables transfers for an approved editor and substitutes Sign-out", () => {
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

    it("does not grant write access to an unapproved signed-in user", () => {
        render(<BoardMenu {...props()} currentUser={{ email: "reader@test.com", role: "user", isApproved: false }} />);
        expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });

    it("hides board-specific actions on the board list", () => {
        render(<BoardMenu {...props()} currentBoard={undefined} currentUser={null} />);
        expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About" })).toBeEnabled();
    });
});

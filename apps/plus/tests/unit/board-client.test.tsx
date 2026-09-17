import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import SharedBoardClient from "@meldrift/board/BoardClient";
import { createEmptyBoardSnapshot } from "@meldrift/board/board-state";
import BoardClient from "@/components/BoardClient";

const mocks = vi.hoisted(() => ({
    canEditCard: true,
    savePaused: false,
    changedSnapshot: null as unknown,
    schedulePreviewUpdate: vi.fn(),
}));

vi.mock("@meldrift/board/BoardClient", () => ({
    default: vi.fn((props: ComponentProps<typeof SharedBoardClient>) => (
        <div data-testid="shared-board" data-can-edit={props.canEdit}>
            {props.renderControls({
                snapshot: (mocks.changedSnapshot ?? props.initialSnapshot) as typeof props.initialSnapshot,
                savePaused: mocks.savePaused,
                setMessage: vi.fn(),
                menuOpen: false,
                setMenuOpen: vi.fn(),
                reorderOpen: false,
                onReorder: vi.fn(),
                onCompileMarkdown: vi.fn(),
                onAbout: vi.fn(),
                closeOverlays: vi.fn(),
            })}
        </div>
    )),
}));
vi.mock("@/hooks/useBoardAuth", () => ({
    useBoardAuth: () => ({
        canEditCard: mocks.canEditCard,
        currentUser: { email: "editor@example.com", isApproved: mocks.canEditCard, role: "user" },
        signInOpen: false, signUpOpen: false,
        setSignInOpen: vi.fn(), setSignUpOpen: vi.fn(),
        setCurrentUser: vi.fn(), handleSignOut: vi.fn(),
    }),
}));
vi.mock("@/hooks/useBoardPreview", () => ({
    useBoardPreview: () => ({ schedulePreviewUpdate: mocks.schedulePreviewUpdate }),
}));
vi.mock("@/components/BoardMenu", () => ({ default: () => null }));
vi.mock("@/components/SignInModal", () => ({ default: () => null }));
vi.mock("@/components/SignUpModal", () => ({ default: () => null }));

describe("Plus shared board integration", () => {
    beforeEach(() => {
        mocks.canEditCard = true;
        mocks.savePaused = false;
        mocks.changedSnapshot = null;
    });

    it("does not reupload initial data and saves edited data only after editing ends", () => {
        const initialSnapshot = createEmptyBoardSnapshot();
        const onSnapshotChange = vi.fn();
        const props = { initialSnapshot, onSnapshotChange, editingAllowed: true, serverSaveVersion: 0 };
        const { rerender } = render(<BoardClient {...props} />);
        expect(onSnapshotChange).not.toHaveBeenCalled();

        const updated = { ...initialSnapshot, strokes: [...initialSnapshot.strokes] };
        mocks.changedSnapshot = updated;
        mocks.savePaused = true;
        rerender(<BoardClient {...props} />);
        expect(onSnapshotChange).not.toHaveBeenCalled();

        mocks.savePaused = false;
        rerender(<BoardClient {...props} />);
        expect(onSnapshotChange).toHaveBeenCalledExactlyOnceWith(updated);
        rerender(<BoardClient {...props} serverSaveVersion={1} />);
        expect(onSnapshotChange).toHaveBeenCalledTimes(1);
        expect(mocks.schedulePreviewUpdate).toHaveBeenCalledOnce();
    });

    it("passes both account and lease permissions to the shared editor and blocks saves", () => {
        const initialSnapshot = createEmptyBoardSnapshot();
        const onSnapshotChange = vi.fn();
        const props = { initialSnapshot, onSnapshotChange, editingAllowed: false, serverSaveVersion: 0 };
        const { rerender } = render(<BoardClient {...props} />);
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "false");

        mocks.changedSnapshot = { ...initialSnapshot, strokes: [] };
        rerender(<BoardClient {...props} />);
        expect(onSnapshotChange).not.toHaveBeenCalled();

        mocks.canEditCard = false;
        rerender(<BoardClient {...props} editingAllowed />);
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "false");
        expect(onSnapshotChange).not.toHaveBeenCalled();
    });
});

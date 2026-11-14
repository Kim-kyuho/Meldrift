import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import SharedBoardClient from "@meldrift/ui/BoardClient";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";
import BoardClient from "@/components/BoardClient";

const mocks = vi.hoisted(() => ({
    canEditCard: true,
    savePaused: false,
    changedSnapshot: null as unknown,
    schedulePreviewUpdate: vi.fn(),
    setMessage: vi.fn(),
}));

vi.mock("@meldrift/ui/BoardClient", () => ({
    default: vi.fn((props: ComponentProps<typeof SharedBoardClient>) => (
        <div data-testid="shared-board" data-can-edit={props.canEdit}>
            {props.renderControls({
                snapshot: (mocks.changedSnapshot ?? props.initialSnapshot) as typeof props.initialSnapshot,
                savePaused: mocks.savePaused,
                setMessage: mocks.setMessage,
                menuOpen: false,
                setMenuOpen: vi.fn(),
                reorderOpen: false,
                onReorder: vi.fn(),
                onCompileMarkdown: vi.fn(),
                onAbout: vi.fn(),
                closeOverlays: vi.fn(),
                replaceSnapshot: vi.fn(),
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

describe("플러스 공통 보드 통합", () => {
    const files = {
        exportSnapshot: vi.fn(async () => new ArrayBuffer(16)),
        readSnapshotFile: vi.fn(async () => createEmptyBoardSnapshot()),
    };
    beforeEach(() => {
        vi.useFakeTimers();
        mocks.canEditCard = true;
        mocks.savePaused = false;
        mocks.changedSnapshot = null;
    });
    afterEach(() => vi.useRealTimers());

    it("변경을 합치고 언마운트 후에는 저장하지 않는다", async () => {
        const initialSnapshot = createEmptyBoardSnapshot();
        const onSnapshotChange = vi.fn();
        const props = { initialSnapshot, onSnapshotChange, editingAllowed: true, serverSaveVersion: 0, ...files };
        const { rerender, unmount } = render(<BoardClient {...props} />);
        mocks.changedSnapshot = { ...initialSnapshot, strokes: [] };
        rerender(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(100));

        const latest = { ...initialSnapshot, strokes: [] };
        mocks.changedSnapshot = latest;
        rerender(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(149));
        expect(onSnapshotChange).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(onSnapshotChange).toHaveBeenCalledExactlyOnceWith(latest);

        mocks.changedSnapshot = { ...latest, strokes: [] };
        rerender(<BoardClient {...props} />);
        unmount();
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    it.each(["editing", "permission"])("%s 변경 시 예약된 저장을 취소하고 최신 스냅샷으로 재개한다", async (reason) => {
        const initialSnapshot = createEmptyBoardSnapshot();
        const onSnapshotChange = vi.fn();
        const props = { initialSnapshot, onSnapshotChange, editingAllowed: true, serverSaveVersion: 0, ...files };
        const { rerender } = render(<BoardClient {...props} />);
        mocks.changedSnapshot = { ...initialSnapshot, strokes: [] };
        rerender(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(100));

        mocks.savePaused = reason === "editing";
        rerender(<BoardClient {...props} editingAllowed={reason !== "permission"} />);
        await act(async () => vi.advanceTimersByTimeAsync(500));
        expect(onSnapshotChange).not.toHaveBeenCalled();

        const latest = { ...initialSnapshot, strokes: [] };
        mocks.changedSnapshot = latest;
        mocks.savePaused = false;
        rerender(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(onSnapshotChange).toHaveBeenCalledExactlyOnceWith(latest);
    });

    it("초기 데이터는 재전송하지 않고 편집 종료 150ms 후 변경 데이터를 저장한다", async () => {
        const initialSnapshot = createEmptyBoardSnapshot();
        const onSnapshotChange = vi.fn();
        const props = { initialSnapshot, onSnapshotChange, editingAllowed: true, serverSaveVersion: 0, ...files };
        const { rerender } = render(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(onSnapshotChange).not.toHaveBeenCalled();

        const updated = { ...initialSnapshot, strokes: [...initialSnapshot.strokes] };
        mocks.changedSnapshot = updated;
        mocks.savePaused = true;
        rerender(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(onSnapshotChange).not.toHaveBeenCalled();

        mocks.savePaused = false;
        rerender(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(149));
        expect(onSnapshotChange).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(onSnapshotChange).toHaveBeenCalledExactlyOnceWith(updated);
        rerender(<BoardClient {...props} serverSaveVersion={1} />);
        expect(onSnapshotChange).toHaveBeenCalledTimes(1);
        expect(mocks.schedulePreviewUpdate).toHaveBeenCalledOnce();
    });

    it("계정·리스 권한을 공통 에디터에 전달하고 저장을 차단한다", async () => {
        const initialSnapshot = createEmptyBoardSnapshot();
        const onSnapshotChange = vi.fn();
        const props = { initialSnapshot, onSnapshotChange, editingAllowed: false, serverSaveVersion: 0, ...files };
        const { rerender } = render(<BoardClient {...props} />);
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "false");

        mocks.changedSnapshot = { ...initialSnapshot, strokes: [] };
        rerender(<BoardClient {...props} />);
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(onSnapshotChange).not.toHaveBeenCalled();

        mocks.canEditCard = false;
        rerender(<BoardClient {...props} editingAllowed />);
        await act(async () => vi.advanceTimersByTimeAsync(150));
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "false");
        expect(onSnapshotChange).not.toHaveBeenCalled();
    });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import SharedBoardClient from "@meldrift/ui/BoardClient";
import type { BoardStorage } from "@meldrift/ui/board-storage";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";
import BoardClient from "@/components/BoardClient";

const mocks = vi.hoisted(() => ({
    approved: true,
    signedIn: true,
    schedulePreviewUpdate: vi.fn(),
    sharedProps: null as ComponentProps<typeof SharedBoardClient> | null,
    menuProps: null as Record<string, unknown> | null,
}));

vi.mock("@meldrift/ui/BoardClient", () => ({
    default: vi.fn((props: ComponentProps<typeof SharedBoardClient>) => {
        mocks.sharedProps = props;
        return (
            <div data-testid="shared-board" data-can-edit={props.canEdit} data-can-export={props.canExport}>
                {props.renderMenu({ menuOpen: false, setMenuOpen: vi.fn(), onAbout: vi.fn() })}
            </div>
        );
    }),
}));
vi.mock("@/hooks/useBoardAuth", () => ({
    useBoardAuth: () => ({
        currentUser: mocks.signedIn
            ? { email: "editor@example.com", isApproved: mocks.approved, role: "user" }
            : null,
        signInOpen: false, signUpOpen: false,
        setSignInOpen: vi.fn(), setSignUpOpen: vi.fn(),
        setCurrentUser: vi.fn(), handleSignOut: vi.fn(),
    }),
}));
vi.mock("@/hooks/useBoardPreview", () => ({
    useBoardPreview: () => ({ schedulePreviewUpdate: mocks.schedulePreviewUpdate }),
}));
vi.mock("@/components/BoardMenu", () => ({
    default: (props: Record<string, unknown>) => {
        mocks.menuProps = props;
        return null;
    },
}));
vi.mock("@/components/SignInModal", () => ({ default: () => null }));
vi.mock("@/components/SignUpModal", () => ({ default: () => null }));

describe("플러스 공통 보드 통합", () => {
    const storage: BoardStorage = { save: vi.fn() };
    const initialSnapshot = createEmptyBoardSnapshot();
    const props = { initialSnapshot, storage, editingAllowed: true, serverSaveVersion: 0 };

    beforeEach(() => {
        mocks.approved = true;
        mocks.signedIn = true;
        mocks.sharedProps = null;
        mocks.menuProps = null;
    });

    it("저장소를 공통 에디터에 그대로 넘긴다", () => {
        render(<BoardClient {...props} />);

        expect(mocks.sharedProps?.storage).toBe(storage);
    });

    it("승인된 편집자에게 편집과 내보내기를 허용한다", () => {
        render(<BoardClient {...props} />);

        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "true");
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-export", "true");
    });

    it("보드 권한이나 계정 승인이 없으면 편집을 막고, 로그인했다면 내보내기는 허용한다", () => {
        const { rerender } = render(<BoardClient {...props} editingAllowed={false} />);
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "false");

        mocks.approved = false;
        rerender(<BoardClient {...props} />);
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "false");
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-export", "true");
    });

    it("로그인하지 않으면 내보내기도 막는다", () => {
        mocks.signedIn = false;
        render(<BoardClient {...props} />);

        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-edit", "false");
        expect(screen.getByTestId("shared-board")).toHaveAttribute("data-can-export", "false");
    });

    it("메뉴에 계정 정보를 넘긴다", () => {
        render(<BoardClient {...props} />);

        expect(mocks.menuProps?.currentUser).toEqual(expect.objectContaining({ email: "editor@example.com" }));
    });

    it("Plus Help 문서와 마스코트로 안내를 켠다", () => {
        render(<BoardClient {...props} />);

        expect(mocks.sharedProps?.guide).toEqual(expect.objectContaining({
            key: "plus",
            helpMarkdownUrl: "/plus/help/Help_Meldrift.md",
            mascotUrl: "/plus/meldrift-mascot.png",
        }));
    });

    it("서버 저장이 끝나면 편집자에게만 미리보기 갱신을 예약한다", () => {
        const { rerender } = render(<BoardClient {...props} />);
        expect(mocks.schedulePreviewUpdate).not.toHaveBeenCalled();

        rerender(<BoardClient {...props} serverSaveVersion={1} />);
        expect(mocks.schedulePreviewUpdate).toHaveBeenCalledOnce();

        rerender(<BoardClient {...props} editingAllowed={false} serverSaveVersion={2} />);
        expect(mocks.schedulePreviewUpdate).toHaveBeenCalledOnce();
    });
});

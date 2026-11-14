import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { useBoardList } from "@/hooks/useBoardList";

const boards = [
    { boardId: 1, title: "One", width: 100, height: 100, previewUrl: "https://example.com/1.webp" },
    { boardId: 2, title: "Two", width: 200, height: 200, previewUrl: "https://example.com/2.webp" },
];

describe("useBoardList 동작", () => {
    afterEach(() => {
        window.sessionStorage.clear();
        vi.unstubAllGlobals();
    });

    it("관리자에게만 생성·작업 컨트롤 열기를 허용한다", () => {
        const denied = renderHook(() => useBoardList({ boards, currentUser: null }));
        act(() => denied.result.current.handleCreateBoardClick());
        expect(denied.result.current.createBoardOpen).toBe(false);
        expect(denied.result.current.boardListMessage).toBe("Only administrators can create boards.");
        act(() => denied.result.current.openBoardActionMenu(1));
        expect(denied.result.current.actionMenuOpen).toBe(false);
        denied.unmount();

        const admin = renderHook(() => useBoardList({
            boards,
            currentUser: { email: "admin@example.com", isApproved: true, role: "admin" },
        }));
        act(() => admin.result.current.handleCreateBoardClick());
        expect(admin.result.current.createBoardOpen).toBe(true);
        act(() => admin.result.current.openBoardActionMenu(1));
        expect(admin.result.current.selectedBoardId).toBe(1);
        expect(admin.result.current.actionMenuOpen).toBe(true);
    });

    it("이름을 바꾼 보드를 갱신하고 새 보드로 이동한다", () => {
        const { result } = renderHook(() => useBoardList({
            boards,
            currentUser: { email: "admin@example.com", isApproved: true, role: "admin" },
        }));

        act(() => result.current.handleBoardRenamed(2, "Renamed"));
        expect(result.current.boardList[1].title).toBe("Renamed");
        act(() => result.current.handleBoardCreated(9));
        expect(router.push).toHaveBeenCalledWith("/boards/9");
    });

    it("보드 미리보기가 없으면 최초 미리보기 생성을 예약한다", () => {
        const { result } = renderHook(() => useBoardList({
            boards,
            currentUser: null,
        }));

        act(() => result.current.handleBoardClick(1, true));

        expect(window.sessionStorage.getItem("meldrift-preview-board-id")).toBe("1");
    });

    it("선택한 보드를 삭제하고 경로를 새로고침한다", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ ok: true }),
        }));
        const { result } = renderHook(() => useBoardList({
            boards,
            currentUser: { email: "admin@example.com", isApproved: true, role: "admin" },
        }));
        act(() => result.current.openBoardActionMenu(2));
        act(() => result.current.openDeleteDialog());
        await act(async () => result.current.handleDeleteBoard());

        expect(fetch).toHaveBeenCalledWith("/api/boards/2", { method: "DELETE" });
        expect(result.current.boardList.map((board) => board.boardId)).toEqual([1]);
        expect(result.current.deleteDialogOpen).toBe(false);
        expect(result.current.selectedBoardId).toBeNull();
        expect(router.refresh).toHaveBeenCalled();
    });
});

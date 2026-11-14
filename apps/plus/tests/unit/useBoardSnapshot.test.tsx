import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";
import { useBoardSnapshot } from "@/hooks/useBoardSnapshot";

const mocks = vi.hoisted(() => ({ createDatabase: vi.fn() }));
vi.mock("@meldrift/board-data/browser-db/client", () => ({ createBoardDatabase: mocks.createDatabase }));

const board = { ...createEmptyBoardSnapshot().board, boardId: 7 };
const snapshot = { ...createEmptyBoardSnapshot(), board };
let sync: { revision: number; generation: number; dirty: boolean; changedAt: number; mutationId?: string };
let database: ReturnType<typeof makeDatabase>;

function makeDatabase() {
    return {
        record: vi.fn(async () => ({ bytes: new ArrayBuffer(16), sync: { ...sync } })),
        load: vi.fn(async () => snapshot),
        replace: vi.fn(async () => {}),
        import: vi.fn(async () => {
            sync = { ...sync, revision: 2, dirty: false };
            return snapshot;
        }),
        export: vi.fn(async () => new ArrayBuffer(16)),
        acknowledge: vi.fn(async (_generation: number, revision: number) => {
            sync = { ...sync, revision, dirty: false };
        }),
        close: vi.fn(),
    };
}

describe("플러스 스냅샷 생명주기", () => {
    beforeEach(() => {
        sessionStorage.clear();
        sync = { revision: 1, generation: 1, dirty: false, changedAt: 0 };
        database = makeDatabase();
        mocks.createDatabase.mockReturnValue(database);
        vi.stubGlobal("fetch", vi.fn(async (url: string) => {
            if (url === "/api/me") {
                return Response.json({ user: { email: "editor@example.com", isApproved: true } });
            }
            return new Response(new Uint8Array(16), { headers: { "Content-Type": "application/vnd.sqlite3", "X-Snapshot-Revision": "1" } });
        }));
    });
    afterEach(async () => {
        await act(async () => {});
        vi.unstubAllGlobals();
    });

    it("같은 로컬 리비전은 가져오기 없이 불러오고 언마운트 시 데이터베이스를 닫는다", async () => {
        const { result, unmount } = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(result.current.canEdit).toBe(true));
        expect(database.import).not.toHaveBeenCalled();
        expect(mocks.createDatabase).toHaveBeenCalledWith("meldrift-plus:editor%40example.com:7", board);
        unmount();
        await waitFor(() => expect(database.close).toHaveBeenCalledOnce());
    });

    it("StrictMode에서도 초기화를 완료한다", async () => {
        const { result, unmount } = renderHook(() => useBoardSnapshot(board), { wrapper: StrictMode });
        await waitFor(() => expect(result.current.canEdit).toBe(true));
        unmount();
    });

    it("같은 보드의 두 번째 화면을 거부하지 않고 연다", async () => {
        const first = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(first.result.current.canEdit).toBe(true));
        const second = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(second.result.current.canEdit).toBe(true));
        expect(second.result.current.status).not.toBe("blocked");
        first.unmount();
        second.unmount();
    });

    it("서버 복원을 명시적으로 선택하기 전까지 충돌한 로컬 데이터를 보존한다", async () => {
        sync = { revision: 0, generation: 3, dirty: true, changedAt: Date.now(), mutationId: "local-change" };
        const { result, unmount } = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(result.current.status).toBe("blocked"));
        expect(database.import).not.toHaveBeenCalled();
        expect(database.replace).not.toHaveBeenCalled();
        unmount();
    });

    it("응답이 유실되었지만 이미 승인된 업로드를 확인 처리한다", async () => {
        sync = { revision: 0, generation: 3, dirty: true, changedAt: Date.now(), mutationId: "accepted-change" };
        const original = vi.mocked(fetch).getMockImplementation()!;
        vi.mocked(fetch).mockImplementation(async (...args) => {
            const response = await original(...args);
            if (String(args[0]).endsWith("/snapshot")) {
                response.headers.set("X-Snapshot-Mutation", "accepted-change");
            }
            return response;
        });
        const { result, unmount } = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(result.current.canEdit).toBe(true));
        expect(database.acknowledge).toHaveBeenCalledWith(3, 1);
        expect(database.import).not.toHaveBeenCalled();
        unmount();
    });
});

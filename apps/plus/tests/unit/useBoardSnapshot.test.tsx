import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyBoardSnapshot } from "@meldrift/board/board-state";
import { useBoardSnapshot } from "@/hooks/useBoardSnapshot";

const mocks = vi.hoisted(() => ({ createDatabase: vi.fn() }));
vi.mock("@meldrift/board/browser-db/client", () => ({ createBoardDatabase: mocks.createDatabase }));

const board = { ...createEmptyBoardSnapshot().board, boardId: 7 };
const snapshot = { ...createEmptyBoardSnapshot(), board };
let sync: { revision: number; generation: number; dirty: boolean; changedAt: number; mutationId?: string };
let held = false;
let database: ReturnType<typeof makeDatabase>;

function makeDatabase() {
    return {
        record: vi.fn(async () => ({ bytes: new ArrayBuffer(16), sync: { ...sync } })),
        load: vi.fn(async () => snapshot),
        replace: vi.fn(async () => {}),
        import: vi.fn(async () => { sync = { ...sync, revision: 2, dirty: false }; return snapshot; }),
        export: vi.fn(async () => new ArrayBuffer(16)),
        acknowledge: vi.fn(async (_generation: number, revision: number) => { sync = { ...sync, revision, dirty: false }; }),
        close: vi.fn(),
    };
}

describe("Plus snapshot lifecycle", () => {
    beforeEach(() => {
        sessionStorage.clear();
        held = false;
        sync = { revision: 1, generation: 1, dirty: false, changedAt: 0 };
        database = makeDatabase();
        mocks.createDatabase.mockReturnValue(database);
        Object.defineProperty(navigator, "locks", { configurable: true, value: {
            request: vi.fn(async (_name, _options, callback) => {
                if (held) return callback(null);
                held = true;
                try { await callback({ name: "editor" }); }
                finally { held = false; }
            }),
        } });
        vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
            if (url === "/api/me") return Response.json({ user: { email: "editor@example.com", isApproved: true } });
            if (url === "/api/editor-lease") return new Response(null, { status: options?.method === "DELETE" ? 204 : 200 });
            return new Response(new Uint8Array(16), { headers: { "Content-Type": "application/vnd.sqlite3", "X-Snapshot-Revision": "1" } });
        }));
    });
    afterEach(async () => { await act(async () => {}); vi.unstubAllGlobals(); });

    it("loads a matching local revision without importing and releases the editor on unmount", async () => {
        const { result, unmount } = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(result.current.canEdit).toBe(true));
        expect(database.import).not.toHaveBeenCalled();
        expect(mocks.createDatabase).toHaveBeenCalledWith("meldrift-plus:editor%40example.com:7", board);
        unmount();
        await waitFor(() => expect(held).toBe(false));
        expect(database.close).toHaveBeenCalledOnce();
    });

    it("reuses the tab identifier on reload and survives StrictMode initialization", async () => {
        sessionStorage.setItem("meldrift-plus-editor:editor@example.com", "persisted-tab-identifier-1234");
        const { result, unmount } = renderHook(() => useBoardSnapshot(board), { wrapper: StrictMode });
        await waitFor(() => expect(result.current.canEdit).toBe(true));
        const lease = vi.mocked(fetch).mock.calls.find(([url, options]) => url === "/api/editor-lease" && options?.method === "POST");
        expect(JSON.parse(lease?.[1]?.body as string)).toEqual({ tabId: "persisted-tab-identifier-1234" });
        unmount();
        await waitFor(() => expect(held).toBe(false));
    });

    it("does not open a database or acquire a server lease in a second tab", async () => {
        held = true;
        const { result, unmount } = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(result.current.status).toBe("blocked"));
        expect(mocks.createDatabase).not.toHaveBeenCalled();
        expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/editor-lease")).toBe(false);
        unmount();
    });

    it("preserves conflicting local data until explicit server restore", async () => {
        sync = { revision: 0, generation: 3, dirty: true, changedAt: Date.now(), mutationId: "local-change" };
        const { result, unmount } = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(result.current.status).toBe("blocked"));
        expect(database.import).not.toHaveBeenCalled();
        expect(database.replace).not.toHaveBeenCalled();
        unmount();
        await waitFor(() => expect(held).toBe(false));
    });

    it("acknowledges a previously accepted upload whose response was lost", async () => {
        sync = { revision: 0, generation: 3, dirty: true, changedAt: Date.now(), mutationId: "accepted-change" };
        const original = vi.mocked(fetch).getMockImplementation()!;
        vi.mocked(fetch).mockImplementation(async (...args) => {
            const response = await original(...args);
            if (String(args[0]).endsWith("/snapshot")) response.headers.set("X-Snapshot-Mutation", "accepted-change");
            return response;
        });
        const { result, unmount } = renderHook(() => useBoardSnapshot(board));
        await waitFor(() => expect(result.current.canEdit).toBe(true));
        expect(database.acknowledge).toHaveBeenCalledWith(3, 1);
        expect(database.import).not.toHaveBeenCalled();
        unmount();
        await waitFor(() => expect(held).toBe(false));
    });
});

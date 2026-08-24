import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCardLayer } from "@/hooks/useCardLayer";
import type { BoardImage } from "@/hooks/useBoardImages";
import type { BoardMemo } from "@/hooks/useBoardMemos";
import type { BoardMermaid } from "@/hooks/useBoardMermaids";
import type { BoardTable } from "@/hooks/useBoardTables";

const memo = { id: 1, boardId: 9, content: "memo", x: 0, y: 0, z: 1, width: 100, height: 100, color: "#fff" };
const image = { imageId: 2, boardId: 9, publicId: "p", secureUrl: "url", fileName: null, x: 0, y: 0, z: 2, width: 100, height: 100 };
const mermaid = { id: 3, boardId: 9, source: "flowchart LR", x: 0, y: 0, z: 3, width: 100, height: 100 };
const table = { id: 4, boardId: 9, source: { columns: [{ id: "c", name: "C" }], rows: [] }, x: 0, y: 0, z: 4, width: 100, height: 100 };

function createStateSetter<T>(initial: T[]) {
    let state = initial;
    const setter = vi.fn((update: React.SetStateAction<T[]>) => {
        state = typeof update === "function" ? update(state) : update;
    });
    return { setter, getState: () => state };
}

describe("useCardLayer", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("posts the layer action and applies all returned z values", async () => {
        const memos = createStateSetter<BoardMemo>([memo]);
        const images = createStateSetter<BoardImage>([image]);
        const mermaids = createStateSetter<BoardMermaid>([mermaid]);
        const tables = createStateSetter<BoardTable>([table]);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                ok: true,
                cards: [
                    { type: "memo", id: 1, z: 11 },
                    { type: "image", id: 2, z: 12 },
                    { type: "mermaid", id: 3, z: 13 },
                    { type: "table", id: 4, z: 14 },
                ],
            }),
        }));
        const { result } = renderHook(() => useCardLayer({
            boardId: 9,
            setMemos: memos.setter,
            setImages: images.setter,
            setMermaids: mermaids.setter,
            setTables: tables.setter,
            setPermissionMessage: vi.fn(),
        }));

        await act(async () => result.current.handleCardLayer("memo", 1, "front"));

        expect(fetch).toHaveBeenCalledWith("/api/cards/layer", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ boardId: 9, type: "memo", id: 1, action: "front" }),
        }));
        expect(memos.getState()[0].z).toBe(11);
        expect(images.getState()[0].z).toBe(12);
        expect(mermaids.getState()[0].z).toBe(13);
        expect(tables.getState()[0].z).toBe(14);
    });

    it("does not request a layer update for a temporary card", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const { result } = renderHook(() => useCardLayer({
            boardId: 9,
            setMemos: vi.fn(),
            setImages: vi.fn(),
            setMermaids: vi.fn(),
            setTables: vi.fn(),
            setPermissionMessage: vi.fn(),
        }));

        await act(async () => result.current.handleCardLayer("image", -1, "back"));
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("reports a server failure without changing card state", async () => {
        const setPermissionMessage = vi.fn();
        const setMemos = vi.fn();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            json: vi.fn().mockResolvedValue({ ok: false, message: "Denied" }),
        }));
        const { result } = renderHook(() => useCardLayer({
            boardId: 9,
            setMemos,
            setImages: vi.fn(),
            setMermaids: vi.fn(),
            setTables: vi.fn(),
            setPermissionMessage,
        }));

        await act(async () => result.current.handleCardLayer("memo", 1, "back"));
        expect(setPermissionMessage).toHaveBeenCalledWith("Denied");
        expect(setMemos).not.toHaveBeenCalled();
    });
});

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCardLayer } from "@/hooks/useCardLayer";
import type { BoardImage, BoardMemo, BoardMermaid, BoardTable } from "@/lib/board-state";

const memo: BoardMemo = { id: 1, boardId: 1, content: "memo", x: 0, y: 0, z: 1, width: 100, height: 100, color: "#fff" };
const image: BoardImage = { imageId: 2, boardId: 1, url: "https://example.com/image.png", data: null, mimeType: null, label: null, x: 0, y: 0, z: 2, width: 100, height: 100 };
const mermaid: BoardMermaid = { id: 3, boardId: 1, source: "flowchart LR", x: 0, y: 0, z: 3, width: 100, height: 100 };
const table: BoardTable = { id: 4, boardId: 1, source: { columns: [{ id: "c", name: "C" }], rows: [{ id: "r", cells: { c: "" } }] }, x: 0, y: 0, z: 4, width: 100, height: 100 };

function createStateSetter<T>(initial: T[]) {
    let state = initial;
    const setter = vi.fn((update: React.SetStateAction<T[]>) => {
        state = typeof update === "function" ? update(state) : update;
    });
    return { setter, getState: () => state };
}

function setup() {
    const memos = createStateSetter([memo]);
    const images = createStateSetter([image]);
    const mermaids = createStateSetter([mermaid]);
    const tables = createStateSetter([table]);
    const hook = renderHook(() => useCardLayer({
        memos: [memo], images: [image], mermaids: [mermaid], tables: [table],
        setMemos: memos.setter, setImages: images.setter,
        setMermaids: mermaids.setter, setTables: tables.setter,
    }));
    return { ...hook, memos, images, mermaids, tables };
}

describe("useCardLayer", () => {
    it("moves a card to the front and normalizes every local z value", () => {
        const state = setup();
        act(() => state.result.current.handleCardLayer("memo", 1, "front"));
        expect(state.images.getState()[0].z).toBe(1);
        expect(state.mermaids.getState()[0].z).toBe(2);
        expect(state.tables.getState()[0].z).toBe(3);
        expect(state.memos.getState()[0].z).toBe(4);
    });

    it("moves a card to the back", () => {
        const state = setup();
        act(() => state.result.current.handleCardLayer("table", 4, "back"));
        expect(state.tables.getState()[0].z).toBe(1);
        expect(state.memos.getState()[0].z).toBe(2);
    });

    it("ignores temporary and unknown cards", () => {
        const state = setup();
        act(() => state.result.current.handleCardLayer("memo", -1, "front"));
        act(() => state.result.current.handleCardLayer("memo", 999, "front"));
        expect(state.memos.setter).not.toHaveBeenCalled();
    });
});

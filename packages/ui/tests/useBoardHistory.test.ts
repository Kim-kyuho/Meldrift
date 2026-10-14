import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@meldrift/board-data/board-state";
import { useBoardHistory } from "../src/features/board/useBoardHistory";
import { useBoardPersistence } from "../src/features/board/useBoardPersistence";

function fixture(): BoardSnapshot {
    return {
        ...createEmptyBoardSnapshot(),
        memos: [{ id: 1, syncId: "memo-1", boardId: 1, content: "Original", x: 10, y: 20, z: 1, width: 300, height: 200, color: "#fffadc", sortOrder: 1 }],
        images: [{ imageId: 1, syncId: "image-1", assetId: "asset-1", boardId: 1, url: "", data: new Uint8Array([1, 2, 3]), mimeType: "image/png", label: "image", x: 20, y: 30, z: 2, width: 100, height: 100 }],
        mermaids: [{ id: 1, syncId: "mermaid-1", boardId: 1, source: "flowchart TD", x: 30, y: 40, z: 3, width: 400, height: 300 }],
        tables: [{ id: 1, syncId: "table-1", boardId: 1, source: { columns: [{ id: "c1", name: "A" }], rows: [] }, x: 40, y: 50, z: 4, width: 500, height: 400 }],
        strokes: [{ id: "stroke-1", color: "#000000", width: 3, points: [[0, 0], [10, 10]] }],
    };
}

function setup(initial = fixture()) {
    return renderHook(() => {
        const [snapshot, setSnapshot] = useState(initial);
        const [paused, setPaused] = useState(false);
        const history = useBoardHistory({ snapshot, paused, onRestore: (content) => setSnapshot((previous) => ({ ...previous, ...content })) });
        return { ...history, snapshot, setSnapshot, setPaused };
    });
}

describe("useBoardHistory", () => {
    it.each(["memos", "images", "mermaids", "tables", "strokes"] as const)("restores %s creation and deletion", (key) => {
        const original = fixture();
        const { result } = setup(original);
        act(() => result.current.setSnapshot((previous) => ({ ...previous, [key]: [] })));
        act(() => result.current.undo());
        expect(result.current.snapshot[key]).toBe(original[key]);
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
        act(() => result.current.redo());
        expect(result.current.snapshot[key]).toEqual([]);
        expect(result.current.canRedo).toBe(false);
    });

    it("restores content, geometry, layers and order as one atomic board change", () => {
        const original = fixture();
        const { result } = setup(original);
        const next = {
            ...original,
            memos: [{ ...original.memos[0], content: "Changed", x: 100, width: 600, z: 5, sortOrder: 2 }],
            images: [{ ...original.images[0], y: 200, height: 250, z: 6 }],
            mermaids: [{ ...original.mermaids[0], source: "sequenceDiagram", width: 700 }],
            tables: [{ ...original.tables[0], source: { columns: [{ id: "c2", name: "B" }], rows: [] }, height: 500 }],
            strokes: [],
        };
        act(() => result.current.setSnapshot(next));
        act(() => result.current.undo());
        expect(result.current.snapshot).toEqual(original);
        expect(result.current.canUndo).toBe(false);
        act(() => result.current.redo());
        expect(result.current.snapshot).toEqual(next);
    });

    it("groups pointer frames into one operation on release", () => {
        const original = fixture();
        const { result } = setup(original);
        act(() => result.current.setPaused(true));
        for (let x = 0; x < 10; x++) {
            act(() => result.current.setSnapshot((previous) => ({ ...previous, strokes: [{ ...previous.strokes[0], points: [[x, 0], [x, 10]] }] })));
        }
        expect(result.current.canUndo).toBe(false);
        act(() => result.current.setPaused(false));
        act(() => result.current.undo());
        expect(result.current.snapshot.strokes).toBe(original.strokes);
        expect(result.current.canUndo).toBe(false);
    });

    it("does not add identical values or viewport and board metadata changes", () => {
        const { result } = setup();
        act(() => result.current.setSnapshot((previous) => ({
            ...previous, board: { ...previous.board, title: "Other title" },
            memos: previous.memos.map((memo) => ({ ...memo })),
        })));
        expect(result.current.canUndo).toBe(false);
    });

    it("shares unchanged objects and binary data across history entries", () => {
        const original = fixture();
        const { result } = setup(original);
        act(() => result.current.setSnapshot((previous) => ({ ...previous, images: [{ ...previous.images[0], x: 999 }], memos: previous.memos.map((memo) => ({ ...memo })) })));
        act(() => result.current.undo());
        act(() => result.current.redo());
        expect(result.current.snapshot.memos[0]).toBe(original.memos[0]);
        expect(result.current.snapshot.images[0].data).toBe(original.images[0].data);
        expect(original.images[0].x).toBe(20);
    });

    it("clears redo only after a new completed change", () => {
        const { result } = setup();
        act(() => result.current.setSnapshot((previous) => ({ ...previous, strokes: [] })));
        act(() => result.current.undo());
        act(() => result.current.setPaused(true));
        act(() => result.current.setSnapshot((previous) => ({ ...previous, images: [] })));
        act(() => result.current.setPaused(false));
        expect(result.current.canRedo).toBe(false);
    });

    it("retains at most fifty operations", () => {
        const { result } = setup();
        for (let x = 1; x <= 55; x++) {
            act(() => result.current.setSnapshot((previous) => ({ ...previous, memos: [{ ...previous.memos[0], x }] })));
        }
        for (let step = 0; step < 50; step++) {
            act(() => result.current.undo());
        }
        expect(result.current.snapshot.memos[0].x).toBe(5);
        expect(result.current.canUndo).toBe(false);
    });

    it("clears history when a new board or restored server state is seeded", () => {
        const { result } = setup();
        act(() => result.current.setSnapshot((previous) => ({ ...previous, strokes: [] })));
        const restored = createEmptyBoardSnapshot();
        act(() => {
            result.current.reset(restored);
            result.current.setSnapshot(restored);
        });
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it("persists undo and redo through the existing local save debounce", async () => {
        vi.useFakeTimers();
        try {
            const onSave = vi.fn();
            const original = fixture();
            const { result } = renderHook(() => {
                const [snapshot, setSnapshot] = useState(original);
                const history = useBoardHistory({ snapshot, paused: false, onRestore: (content) => setSnapshot((previous) => ({ ...previous, ...content })) });
                useBoardPersistence({ snapshot, savePaused: false, onSave, onError: vi.fn(), skipInitialSave: true });
                return { ...history, setSnapshot };
            });
            act(() => result.current.setSnapshot((previous) => ({ ...previous, images: [] })));
            await act(async () => vi.advanceTimersByTimeAsync(150));
            act(() => result.current.undo());
            await act(async () => vi.advanceTimersByTimeAsync(150));
            expect(onSave.mock.calls[1][0].images[0].data).toBe(original.images[0].data);
            act(() => result.current.redo());
            await act(async () => vi.advanceTimersByTimeAsync(150));
            expect(onSave.mock.calls[2][0].images).toEqual([]);
        } finally {
            vi.useRealTimers();
        }
    });
});

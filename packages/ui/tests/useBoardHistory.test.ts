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

describe("useBoardHistory 동작", () => {
    it.each(["memos", "images", "mermaids", "tables", "strokes"] as const)("%s 카드의 생성과 삭제를 복원한다", (key) => {
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

    it("내용·위치·크기·레이어·순서를 하나의 원자적 보드 변경으로 복원한다", () => {
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

    it("포인터를 놓으면 이동 프레임들을 하나의 작업으로 묶는다", () => {
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

    it("같은 값이나 뷰포트·보드 메타데이터 변경은 이력에 추가하지 않는다", () => {
        const { result } = setup();
        act(() => result.current.setSnapshot((previous) => ({
            ...previous, board: { ...previous.board, title: "Other title" },
            memos: previous.memos.map((memo) => ({ ...memo })),
        })));
        expect(result.current.canUndo).toBe(false);
    });

    it("이력 항목 사이에서 변경되지 않은 객체와 바이너리 데이터를 공유한다", () => {
        const original = fixture();
        const { result } = setup(original);
        act(() => result.current.setSnapshot((previous) => ({ ...previous, images: [{ ...previous.images[0], x: 999 }], memos: previous.memos.map((memo) => ({ ...memo })) })));
        act(() => result.current.undo());
        act(() => result.current.redo());
        expect(result.current.snapshot.memos[0]).toBe(original.memos[0]);
        expect(result.current.snapshot.images[0].data).toBe(original.images[0].data);
        expect(original.images[0].x).toBe(20);
    });

    it("새 변경을 완료한 뒤에만 다시 실행 이력을 비운다", () => {
        const { result } = setup();
        act(() => result.current.setSnapshot((previous) => ({ ...previous, strokes: [] })));
        act(() => result.current.undo());
        act(() => result.current.setPaused(true));
        act(() => result.current.setSnapshot((previous) => ({ ...previous, images: [] })));
        act(() => result.current.setPaused(false));
        expect(result.current.canRedo).toBe(false);
    });

    it("최근 작업을 최대 50개까지 유지한다", () => {
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

    it("새 보드나 복원된 서버 상태를 초기값으로 적용하면 이력을 비운다", () => {
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

    it("기존 로컬 저장 디바운스를 통해 실행 취소·다시 실행을 저장한다", async () => {
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

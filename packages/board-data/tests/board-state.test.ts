import { describe, expect, it } from "vitest";
import { defaultTableSource } from "@meldrift/core/table-card";
import {
    assignSnapshotToBoard, createEmptyBoardSnapshot,
    type BoardImage, type BoardInfo, type BoardMemo, type BoardMermaid, type BoardTable,
} from "../src/board-state";

const targetBoard: BoardInfo = { boardId: 7, title: "Target", width: 3000, height: 2000 };

const memo: BoardMemo = {
    id: 1, syncId: "memo-1", boardId: 3, content: "<p>memo</p>",
    x: 0, y: 0, z: 1, width: 300, height: 200, color: "#fffadc", sortOrder: 1,
};

const image: BoardImage = {
    imageId: 1, syncId: "image-1", assetId: "asset-1", boardId: 3, url: "", data: new Uint8Array([1]),
    mimeType: "image/webp", label: "a.webp", x: 0, y: 0, z: 1, width: 400, height: 300,
};

const mermaid: BoardMermaid = {
    id: 1, syncId: "mermaid-1", boardId: 3, source: "graph TD; A-->B",
    x: 0, y: 0, z: 1, width: 480, height: 360,
};

const table: BoardTable = {
    id: 1, syncId: "table-1", boardId: 3, source: defaultTableSource,
    x: 0, y: 0, z: 1, width: 560, height: 360,
};

describe("assignSnapshotToBoard 동작", () => {
    it("보드 정보와 모든 카드의 boardId를 대상 보드로 바꾼다", () => {
        const snapshot = {
            ...createEmptyBoardSnapshot(),
            memos: [memo], images: [image], mermaids: [mermaid], tables: [table],
        };

        const assigned = assignSnapshotToBoard(snapshot, targetBoard);

        expect(assigned.board).toEqual(targetBoard);
        expect(assigned.memos[0].boardId).toBe(7);
        expect(assigned.images[0].boardId).toBe(7);
        expect(assigned.mermaids[0].boardId).toBe(7);
        expect(assigned.tables[0].boardId).toBe(7);
    });

    it("카드 내용과 동기화 식별자는 그대로 둔다", () => {
        const snapshot = { ...createEmptyBoardSnapshot(), memos: [memo] };

        const assigned = assignSnapshotToBoard(snapshot, targetBoard);

        expect(assigned.memos[0]).toEqual({ ...memo, boardId: 7 });
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";
import { isNewBoardEntry, recordBoardEntry, type BoardGuide } from "../src/features/guide/board-guide";

const guide: BoardGuide = {
    key: "test",
    helpMarkdownUrl: "/help/Help_Meldrift.md",
    helpShortcutsUrl: "/help/Help_Shortcuts.md",
    mascotUrl: "/meldrift-mascot.png",
};

function populatedSnapshot() {
    const snapshot = createEmptyBoardSnapshot();
    snapshot.strokes.push({ id: "stroke-1", color: "#000000", width: 3, points: [[0, 0], [1, 1]] });
    return snapshot;
}

describe("새 보드 첫 진입 판정", () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it("처음 여는 빈 보드는 새 보드로 본다", () => {
        expect(isNewBoardEntry(guide, createEmptyBoardSnapshot())).toBe(true);
    });

    it("한 번 연 보드는 다시 새 보드로 보지 않는다", () => {
        const snapshot = createEmptyBoardSnapshot();

        recordBoardEntry(guide, snapshot.board.boardId);

        expect(isNewBoardEntry(guide, snapshot)).toBe(false);
    });

    it("내용이 있는 보드는 처음 열어도 새 보드가 아니다", () => {
        expect(isNewBoardEntry(guide, populatedSnapshot())).toBe(false);
    });

    it("앱과 보드마다 따로 기록한다", () => {
        const snapshot = createEmptyBoardSnapshot();
        recordBoardEntry(guide, snapshot.board.boardId);

        expect(isNewBoardEntry({ ...guide, key: "other" }, snapshot)).toBe(true);
        expect(isNewBoardEntry(guide, { ...snapshot, board: { ...snapshot.board, boardId: 99 } })).toBe(true);
    });

    it("저장소를 쓸 수 없으면 새 보드로 보지 않는다", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("Storage blocked");
        });

        expect(isNewBoardEntry(guide, createEmptyBoardSnapshot())).toBe(false);
    });
});

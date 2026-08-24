import { describe, expect, it } from "vitest";
import {
    createEmptyBoardSnapshot,
    nextPositiveId,
    parseBoardSnapshot,
} from "@/lib/board-state";

describe("browser SQLite board snapshots", () => {
    it("accepts a complete local board snapshot", () => {
        const snapshot = createEmptyBoardSnapshot();
        snapshot.memos.push({
            id: 1, boardId: 1, content: "Saved memo", x: 1, y: 2, z: 3,
            width: 300, height: 200, color: "#fffadc",
        });

        expect(parseBoardSnapshot(snapshot)).toEqual(snapshot);
    });

    it("rejects invalid imported board data", () => {
        const snapshot = createEmptyBoardSnapshot();
        snapshot.images.push({
            imageId: 1, boardId: 1, url: "javascript:alert(1)", label: null,
            data: null, mimeType: null,
            x: 0, y: 0, z: 1, width: 400, height: 300,
        });

        expect(() => parseBoardSnapshot(snapshot)).toThrow(/invalid Meldrift Free Edition data/i);
    });

    it("accepts compressed local image bytes", () => {
        const snapshot = createEmptyBoardSnapshot();
        snapshot.images.push({
            imageId: 1, boardId: 1, url: "", data: new Uint8Array([1, 2, 3]),
            mimeType: "image/webp", label: "photo.webp",
            x: 0, y: 0, z: 1, width: 400, height: 300,
        });

        expect(parseBoardSnapshot(snapshot).images[0].data).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("allocates positive ids after imported records", () => {
        expect(nextPositiveId([-10, 2, 8, 3])).toBe(9);
    });
});

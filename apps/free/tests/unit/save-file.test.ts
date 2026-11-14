import { describe, expect, it } from "vitest";
import {
    createEmptyBoardSnapshot,
    nextPositiveId,
    parseBoardSnapshot,
} from "@/lib/board-state";

describe("브라우저 SQLite 보드 스냅샷", () => {
    it("완전한 로컬 보드 스냅샷을 허용한다", () => {
        const snapshot = createEmptyBoardSnapshot();
        snapshot.memos.push({
            id: 1, syncId: "memo-1", boardId: 1, content: "Saved memo", x: 1, y: 2, z: 3,
            width: 300, height: 200, color: "#fffadc", sortOrder: 1,
        });

        expect(parseBoardSnapshot(snapshot)).toEqual(snapshot);
    });

    it("가져온 보드 데이터가 잘못되면 거부한다", () => {
        const snapshot = createEmptyBoardSnapshot();
        snapshot.images.push({
            imageId: 1, syncId: "image-1", assetId: "", boardId: 1, url: "javascript:alert(1)", label: null,
            data: null, mimeType: null,
            x: 0, y: 0, z: 1, width: 400, height: 300,
        });

        expect(() => parseBoardSnapshot(snapshot)).toThrow(/invalid Meldrift Free Edition data/i);
    });

    it("압축된 로컬 이미지 바이트를 허용한다", () => {
        const snapshot = createEmptyBoardSnapshot();
        snapshot.images.push({
            imageId: 1, syncId: "image-1", assetId: "asset-1", boardId: 1, url: "", data: new Uint8Array([1, 2, 3]),
            mimeType: "image/webp", label: "photo.webp",
            x: 0, y: 0, z: 1, width: 400, height: 300,
        });

        expect(parseBoardSnapshot(snapshot).images[0].data).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("가져온 레코드 다음의 양수 식별자를 할당한다", () => {
        expect(nextPositiveId([-10, 2, 8, 3])).toBe(9);
    });
});

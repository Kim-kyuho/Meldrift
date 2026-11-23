import { describe, expect, it, vi } from "vitest";
import { createEmptyBoardSnapshot, type BoardSnapshot } from "@meldrift/board-data/board-state";
import { createPlusBoardStorage } from "@/lib/board-storage";
import { maxSnapshotBytes } from "@/lib/snapshot";

function importedSnapshot(): BoardSnapshot {
    const imported = createEmptyBoardSnapshot();
    imported.memos.push({
        id: 1, syncId: "memo-1", boardId: 1, content: "Imported", x: 0, y: 0, z: 1,
        width: 300, height: 200, color: "#fff", sortOrder: 1,
    });
    imported.images.push({
        imageId: 1, syncId: "image-1", assetId: "asset-1", boardId: 1, url: "",
        data: new Uint8Array([1, 2, 3]), mimeType: "image/webp", label: "a.webp",
        x: 0, y: 0, z: 1, width: 10, height: 10,
    });
    return imported;
}

function setup(decoded: BoardSnapshot) {
    const options = {
        save: vi.fn(),
        encode: vi.fn(async () => new ArrayBuffer(16)),
        decode: vi.fn(async () => decoded),
    };
    return { options, storage: createPlusBoardStorage(options) };
}

describe("플러스 보드 저장소", () => {
    it("보드 번호로 파일 이름을 만들고 서버 스냅샷 상한을 가져오기 상한으로 쓴다", () => {
        const { storage } = setup(createEmptyBoardSnapshot());

        expect(storage.file?.fileName({ boardId: 7, title: "Board", width: 100, height: 100 }))
            .toBe("meldrift-board-7.sqlite");
        expect(storage.file?.maxImportBytes).toBe(maxSnapshotBytes);
        expect(storage.skipInitialSave).toBe(true);
    });

    it("가져온 카드에는 새 동기화 식별자를 발급한다", async () => {
        const { storage } = setup(importedSnapshot());

        const read = await storage.file!.readFile(new ArrayBuffer(16));

        expect(read.memos[0].syncId).not.toBe("memo-1");
        expect(read.images[0].syncId).not.toBe("image-1");
        expect(read.images[0].assetId).not.toBe("asset-1");
        expect(read.images[0].assetId).not.toBe("");
    });

    it("이미지 바이트가 없는 파일은 거부한다", async () => {
        const imported = importedSnapshot();
        imported.images[0] = { ...imported.images[0], data: null };
        const { storage } = setup(imported);

        await expect(storage.file!.readFile(new ArrayBuffer(16)))
            .rejects.toThrow("The save file must include image binaries.");
    });
});

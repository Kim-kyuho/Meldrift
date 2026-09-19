import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadAsset } from "@/lib/asset-download";

const bytes = new Uint8Array([1, 2, 3]);
const digest = "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";

function respond(meta: Record<string, unknown>, parts: Uint8Array[]) {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
        const url = String(input);
        if (url.includes("/chunks/")) {
            const index = Number(url.slice(url.lastIndexOf("/") + 1));
            return { ok: true, arrayBuffer: async () => parts[index].buffer } as unknown as Response;
        }
        return { ok: true, json: async () => meta } as unknown as Response;
    }));
}

describe("자산 내려받기", () => {
    beforeEach(() => respond(
        { digest, byteLength: 3, mimeType: "image/webp", chunkCount: 2 },
        [new Uint8Array([1, 2]), new Uint8Array([3])],
    ));
    afterEach(() => vi.unstubAllGlobals());

    it("청크를 이어 붙이고 해시를 확인한다", async () => {
        const asset = await downloadAsset("/api/boards/1", "asset-1");

        expect(asset).toEqual({ data: bytes, mimeType: "image/webp" });
    });

    it("해시가 어긋나면 쓰지 않는다", async () => {
        respond({ digest: "f".repeat(64), byteLength: 3, mimeType: "image/webp", chunkCount: 2 },
            [new Uint8Array([1, 2]), new Uint8Array([3])]);

        await expect(downloadAsset("/api/boards/1", "asset-1")).rejects.toThrow("checksum");
    });

    it("선언한 길이보다 짧으면 거절한다", async () => {
        respond({ digest, byteLength: 5, mimeType: "image/webp", chunkCount: 2 },
            [new Uint8Array([1, 2]), new Uint8Array([3])]);

        await expect(downloadAsset("/api/boards/1", "asset-1")).rejects.toThrow("incomplete");
    });

    it("보안 컨텍스트가 아니면 해시를 건너뛰고 보드를 연다", async () => {
        vi.spyOn(globalThis, "crypto", "get").mockReturnValue({ subtle: undefined } as never);

        const asset = await downloadAsset("/api/boards/1", "asset-1");

        expect(asset.data).toEqual(bytes);
    });
});

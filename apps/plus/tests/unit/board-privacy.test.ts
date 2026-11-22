import { getTableName, type Table } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardPrivacyError, prepareBoardPrivacy } from "@/lib/board-privacy";

const mocks = vi.hoisted(() => ({
    images: vi.fn(), sync: vi.fn(), execute: vi.fn(), clearMarkers: vi.fn(), copy: vi.fn(),
    readBytes: vi.fn(), deleteByPrefix: vi.fn(), configure: vi.fn(), snapshot: vi.fn(),
}));
vi.mock("cloudinary", () => ({ v2: { api: { delete_resources_by_prefix: mocks.deleteByPrefix } } }));
vi.mock("@/lib/board-preview-store", () => ({ configureLegacyImageStorage: mocks.configure }));
vi.mock("@/lib/saved-board-snapshot", () => ({ loadSavedBoardSnapshot: mocks.snapshot }));
vi.mock("@/lib/assets", () => ({ readAssetBytes: mocks.readBytes, storeBoardAsset: mocks.copy }));
vi.mock("@/lib/db", () => ({ getDb: () => ({
    select: () => ({ from: (table: Table) => ({
        where: () => getTableName(table) === "images" ? mocks.images() : { limit: mocks.sync },
    }) }),
    execute: mocks.execute,
    update: () => ({ set: () => ({ where: mocks.clearMarkers }) }),
}) }));

const image = {
    imageId: 3, publicId: "meldrift/boards/7/old", assetId: null,
    secureUrl: "https://res.cloudinary.com/demo/image/upload/v123/meldrift/boards/7/old.png",
};

describe("privacy cleanup for retained boards", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv("CLOUDINARY_CLOUD_NAME", "demo");
        mocks.configure.mockReturnValue(true);
        mocks.sync.mockResolvedValue([{ mode: "delta" }]);
        mocks.images.mockResolvedValue([]);
        mocks.execute.mockResolvedValue({ rows: [{ image_id: 3 }] });
        mocks.deleteByPrefix.mockResolvedValue({ deleted: {} });
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("removes only the requested board folder even if transition dropped the original rows", async () => {
        await prepareBoardPrivacy(7, false);
        expect(mocks.copy).not.toHaveBeenCalled();
        expect(mocks.deleteByPrefix).toHaveBeenCalledWith("meldrift/boards/7/", expect.objectContaining({
            resource_type: "image", type: "upload", invalidate: true,
        }));
    });

    it("stores and links the protected bytes before revoking the public folder", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
            headers: { "Content-Type": "image/png" },
        })));
        mocks.images.mockResolvedValue([image]);

        await prepareBoardPrivacy(7, false);

        expect(fetch).toHaveBeenCalledWith(image.secureUrl, expect.objectContaining({ redirect: "error" }));
        expect(mocks.copy).toHaveBeenCalledWith(7, expect.stringMatching(/^legacy-3-/), Buffer.from([1, 2, 3]), "image/png");
        expect(mocks.copy.mock.invocationCallOrder[0]).toBeLessThan(mocks.execute.mock.invocationCallOrder[0]);
        expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteByPrefix.mock.invocationCallOrder[0]);
        expect(mocks.clearMarkers).toHaveBeenCalledOnce();
    });

    it("retries a failed revocation without downloading an already protected image", async () => {
        mocks.images.mockResolvedValue([{ ...image, assetId: "copy-3", secureUrl: null }]);
        mocks.readBytes.mockResolvedValue({ bytes: Buffer.from([1]), mimeType: "image/png" });
        mocks.deleteByPrefix.mockRejectedValueOnce(new Error("Cloudinary unavailable"));
        const fetchOriginal = vi.fn();
        vi.stubGlobal("fetch", fetchOriginal);

        await expect(prepareBoardPrivacy(7, false)).rejects.toBeInstanceOf(BoardPrivacyError);
        expect(mocks.clearMarkers).not.toHaveBeenCalled();
        await prepareBoardPrivacy(7, false);

        expect(fetchOriginal).not.toHaveBeenCalled();
        expect(mocks.clearMarkers).toHaveBeenCalledOnce();
    });

    it("keeps the public copy when download or database linking fails", async () => {
        mocks.images.mockResolvedValue([image]);
        vi.stubGlobal("fetch", vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockResolvedValueOnce(new Response(new Uint8Array([1]), { headers: { "Content-Type": "image/png" } })));
        mocks.execute.mockResolvedValue({ rows: [] });

        await expect(prepareBoardPrivacy(7, false)).rejects.toBeInstanceOf(BoardPrivacyError);
        await expect(prepareBoardPrivacy(7, false)).rejects.toThrow("changed during the copy");
        expect(mocks.deleteByPrefix).not.toHaveBeenCalled();
    });
});

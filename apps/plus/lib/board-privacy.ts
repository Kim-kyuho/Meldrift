import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { maxImageSourceBytes, supportedImageMimeTypes } from "@meldrift/board-data/image-file";
import { v2 as cloudinary } from "cloudinary";
import { getDb } from "@/lib/db";
import { db_boardSync, db_images } from "@/lib/db/schema";
import { loadSavedBoardSnapshot } from "@/lib/saved-board-snapshot";
import { boardPreviewFolder } from "@/lib/board-preview";
import { configureLegacyImageStorage } from "@/lib/board-preview-store";
import { readAssetBytes, storeBoardAsset } from "@/lib/assets";

const deliveryOrigin = "https://res.cloudinary.com";
const legacyDelivery = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i;
const imageTypes = new Set<string>(supportedImageMimeTypes);
type LegacyImage = Pick<typeof db_images.$inferSelect, "imageId" | "publicId" | "secureUrl" | "assetId">;

export class BoardPrivacyError extends Error {}

function originalImageUrl(cloudName: string, folder: string, image: LegacyImage) {
    const base = `${deliveryOrigin}/${encodeURIComponent(cloudName)}/image/upload/`;
    if (image.secureUrl && URL.canParse(image.secureUrl)) {
        const url = new URL(image.secureUrl);
        const basePath = new URL(base).pathname;
        if (url.origin === deliveryOrigin && url.pathname.startsWith(basePath)) {
            const path = url.pathname.slice(basePath.length).replace(/^v\d+\//, "");
            if (path.startsWith(folder) && /^[\w/.-]+$/.test(path)) {
                return url.href;
            }
        }
    }
    const publicId = image.publicId;
    if (publicId?.startsWith(folder) && /^[\w/-]+$/.test(publicId)) {
        return base + publicId;
    }
    throw new BoardPrivacyError("An old image does not belong to the configured board image folder.");
}

async function downloadOriginal(url: string) {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
    const mimeType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!response.ok || !imageTypes.has(mimeType) || !response.body
        || Number(response.headers.get("Content-Length")) > maxImageSourceBytes) {
        throw new BoardPrivacyError("An old image could not be copied into protected storage.");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            size += value.byteLength;
            if (size > maxImageSourceBytes) {
                await reader.cancel();
                throw new BoardPrivacyError("An old image is too large to copy into protected storage.");
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    if (!size) {
        throw new BoardPrivacyError("An old image file was empty.");
    }
    return { data: Buffer.concat(chunks, size), mimeType };
}

async function linkProtectedAsset(boardId: number, image: LegacyImage, assetId: string) {
    const result = await getDb().execute(sql`
        WITH converted AS (
            UPDATE images SET asset_id = ${assetId}, secure_url = NULL, updated_at = now()
            WHERE board_id = ${boardId} AND image_id = ${image.imageId}
                AND asset_id IS NOT DISTINCT FROM ${image.assetId}
                AND secure_url IS NOT DISTINCT FROM ${image.secureUrl}
            RETURNING board_id, image_id
        ), bumped AS (
            UPDATE board_sync SET revision = revision + 1, updated_at = now()
            WHERE board_id IN (SELECT board_id FROM converted) AND mode = 'delta'
        )
        SELECT image_id FROM converted
    `);
    if (!result.rows.length) {
        throw new BoardPrivacyError("An old image changed during the copy. Try again.");
    }
}

async function revokeBoardFolder(folder: string) {
    let cursor: string | undefined;
    do {
        const result: { deleted: Record<string, string>; next_cursor?: string; partial?: boolean } =
            await cloudinary.api.delete_resources_by_prefix(folder, {
                resource_type: "image", type: "upload", invalidate: true, next_cursor: cursor,
            });
        if (!result.deleted || Object.values(result.deleted).some((status) => status !== "deleted" && status !== "not_found")
            || (result.partial && (!result.next_cursor || result.next_cursor === cursor))) {
            throw new BoardPrivacyError("Old public images could not be removed from Cloudinary.");
        }
        cursor = result.next_cursor;
    } while (cursor);
}

export async function prepareBoardPrivacy(boardId: number, hasLegacyPreview: boolean) {
    const db = getDb();
    const [[sync], images] = await Promise.all([
        db.select({ mode: db_boardSync.mode }).from(db_boardSync).where(eq(db_boardSync.boardId, boardId)).limit(1),
        db.select({
            imageId: db_images.imageId, publicId: db_images.publicId, secureUrl: db_images.secureUrl, assetId: db_images.assetId,
        }).from(db_images).where(and(eq(db_images.boardId, boardId), or(
            isNotNull(db_images.publicId), like(db_images.secureUrl, "https://res.cloudinary.com/%/image/upload/%"),
        ))),
    ]);
    if (sync?.mode === "migrating") {
        throw new BoardPrivacyError("The board is being moved. Try again when it finishes.");
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const configured = cloudName && configureLegacyImageStorage();
    const snapshot = sync?.mode === "delta" && configured ? null : await loadSavedBoardSnapshot(boardId);
    if (!configured || !cloudName) {
        if (hasLegacyPreview || images.length || snapshot?.images.some(({ url }) => legacyDelivery.test(url))) {
            throw new BoardPrivacyError("Configure legacy Cloudinary storage before making this board private.");
        }
        return;
    }

    const folder = `${boardPreviewFolder(boardId)}/`;
    const usesImageTable = sync?.mode === "delta" || !snapshot;
    if (usesImageTable) {
        for (const image of images) {
            // A previous attempt may have linked the protected copy before Cloudinary failed.
            if (image.assetId && await readAssetBytes(db, boardId, image.assetId)) {
                if (image.secureUrl) {
                    await linkProtectedAsset(boardId, image, image.assetId);
                }
                continue;
            }
            const { data, mimeType } = await downloadOriginal(originalImageUrl(cloudName, folder, image))
                .catch((error: unknown) => {
                    if (error instanceof BoardPrivacyError) {
                        throw error;
                    }
                    throw new BoardPrivacyError("An old image could not be copied into protected storage.", { cause: error });
                });
            const digest = createHash("sha256").update(data).digest("hex");
            const assetId = `legacy-${image.imageId}-${digest}`;
            await storeBoardAsset(boardId, assetId, data, mimeType);
            await linkProtectedAsset(boardId, image, assetId);
        }
    }

    // The folder also contains previews and originals whose rows were replaced by a previous migration.
    await revokeBoardFolder(folder).catch((error: unknown) => {
        if (error instanceof BoardPrivacyError) {
            throw error;
        }
        throw new BoardPrivacyError("Old public images could not be removed from Cloudinary. Try again.", { cause: error });
    });
    if (images.length) {
        const publicCloudinaryUrl = like(db_images.secureUrl, "https://res.cloudinary.com/%/image/upload/%");
        await db.update(db_images).set({ publicId: null, secureUrl: null }).where(and(
            eq(db_images.boardId, boardId),
            inArray(db_images.imageId, images.map(({ imageId }) => imageId)),
            usesImageTable ? isNull(db_images.secureUrl) : or(isNull(db_images.secureUrl), publicCloudinaryUrl),
        ));
    }
}

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { db_assetChunks, db_assets } from "@/lib/db/schema";
import { assetChunkBytes, stagedChangeMimeType } from "@meldrift/board/board-delta";
import { maxStoredImageBytes, supportedImageMimeTypes } from "@meldrift/board/image-file";
import { maxSnapshotBytes } from "./snapshot";

export { stagedChangeMimeType };


export const uploadSessionTtlMs = 60 * 60 * 1000;
export const assetIdPattern = /^[a-zA-Z0-9:_-]{1,200}$/;

export const chunkCountFor = (byteLength: number) => Math.ceil(byteLength / assetChunkBytes);

export const chunkLengthFor = (byteLength: number, index: number) =>
    Math.min(assetChunkBytes, byteLength - index * assetChunkBytes);

export const uploadRequestSchema = z.object({
    assetId: z.string().regex(assetIdPattern),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    byteLength: z.number().int().min(1).max(maxSnapshotBytes),
    mimeType: z.enum([...supportedImageMimeTypes, stagedChangeMimeType]),
}).refine((upload) => upload.mimeType === stagedChangeMimeType
    || upload.byteLength <= maxStoredImageBytes);

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export async function readAssetBytes(db: NeonHttpDatabase, boardId: number, assetId: string) {
    const result = await db.execute(sql`
        SELECT a.mime_type, string_agg(c.bytes, ''::bytea ORDER BY c.chunk_index) AS bytes
        FROM assets a JOIN asset_chunks c ON c.board_id = a.board_id AND c.asset_id = a.asset_id
        WHERE a.board_id = ${boardId} AND a.asset_id = ${assetId}
        GROUP BY a.mime_type`);
    const row = result.rows[0] as { mime_type: string; bytes: Buffer | string } | undefined;
    if (!row) return null;
    const bytes = typeof row.bytes === "string"
        ? Buffer.from(row.bytes.replace(/^\\x/, ""), "hex")
        : Buffer.from(row.bytes);
    return { mimeType: row.mime_type, bytes };
}

export async function discardAsset(db: NeonHttpDatabase, boardId: number, assetId: string) {
    await db.batch([
        db.delete(db_assetChunks)
            .where(and(eq(db_assetChunks.boardId, boardId), eq(db_assetChunks.assetId, assetId))),
        db.delete(db_assets)
            .where(and(eq(db_assets.boardId, boardId), eq(db_assets.assetId, assetId))),
    ]);
}

export async function receivedChunks(db: NeonHttpDatabase, boardId: number, assetId: string) {
    const rows = await db.select({ chunkIndex: db_assetChunks.chunkIndex }).from(db_assetChunks)
        .where(and(eq(db_assetChunks.boardId, boardId), eq(db_assetChunks.assetId, assetId)))
        .orderBy(db_assetChunks.chunkIndex);
    return rows.map((row) => row.chunkIndex);
}

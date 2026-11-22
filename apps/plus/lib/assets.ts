import { createHash } from "node:crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { db_assetChunks, db_assets } from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { assetChunkBytes, maxStagedChangeBytes, stagedChangeMimeType } from "@meldrift/board-data/board-delta";
import { maxStoredImageBytes, supportedImageMimeTypes } from "@meldrift/board-data/image-file";

export { stagedChangeMimeType };


export const uploadSessionTtlMs = 60 * 60 * 1000;
export const assetIdPattern = /^[a-zA-Z0-9:_-]{1,200}$/;

export const chunkCountFor = (byteLength: number) => Math.ceil(byteLength / assetChunkBytes);

export const boardAssetBytesPath = (boardId: number, assetId: string) => {
    const basePath = process.env.PLUS_STANDALONE === "true" ? "" : "/plus";
    return `${basePath}/api/boards/${boardId}/assets/${encodeURIComponent(assetId)}/bytes`;
};

export async function storeBoardAsset(boardId: number, assetId: string, data: Uint8Array, mimeType: string) {
    const db = getDb();
    const digest = createHash("sha256").update(data).digest("hex");
    const chunkCount = chunkCountFor(data.byteLength);
    const lockBoard = sql`SELECT board_id FROM boards WHERE board_id = ${boardId} FOR UPDATE`;
    for (let index = 0; index < chunkCount; index += 1) {
        const chunk = Buffer.from(data.subarray(index * assetChunkBytes, (index + 1) * assetChunkBytes));
        await db.execute(sql`
            INSERT INTO asset_chunks (board_id, asset_id, chunk_index, bytes)
            SELECT board_id, ${assetId}, ${index}, decode(${chunk.toString("hex")}, 'hex') FROM (${lockBoard}) b
            ON CONFLICT (board_id, asset_id, chunk_index) DO UPDATE SET bytes = excluded.bytes`);
    }
    await db.execute(sql`
        INSERT INTO assets (board_id, asset_id, digest, byte_length, mime_type, chunk_size, chunk_count)
        SELECT board_id, ${assetId}, ${digest}, ${data.byteLength}, ${mimeType}, ${assetChunkBytes}, ${chunkCount}
        FROM (${lockBoard}) b
        ON CONFLICT (board_id, asset_id) DO UPDATE SET
            digest = excluded.digest, byte_length = excluded.byte_length, mime_type = excluded.mime_type,
            chunk_size = excluded.chunk_size, chunk_count = excluded.chunk_count`);
    return digest;
}

export const chunkLengthFor = (byteLength: number, index: number) =>
    Math.min(assetChunkBytes, byteLength - index * assetChunkBytes);

// An asset is one image or one staged change batch, never a whole board, so each carries its own
// limit. Borrowing the snapshot limit here rejected images the browser is allowed to store.
export const uploadByteLimitFor = (mimeType: string) =>
    mimeType === stagedChangeMimeType ? maxStagedChangeBytes : maxStoredImageBytes;

const describeLimit = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MiB`;

export const uploadRequestSchema = z.object({
    assetId: z.string().regex(assetIdPattern),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    byteLength: z.number().int().min(1),
    mimeType: z.enum([...supportedImageMimeTypes, stagedChangeMimeType]),
}).superRefine((upload, context) => {
    const limit = uploadByteLimitFor(upload.mimeType);
    if (upload.byteLength > limit) {
        context.addIssue({
            code: "custom",
            path: ["byteLength"],
            message: `byteLength must be ${describeLimit(limit)} or smaller.`,
        });
    }
});

// The reply names the field and its rule. It never echoes the request, and one shared sentence for
// every violation is what made a rejected upload impossible to tell apart from a broken session.
export function uploadRequestFailure(error: z.ZodError) {
    const [issue] = error.issues;
    const field = issue?.path.join(".") || "body";
    return issue?.code === "custom"
        ? `Invalid upload request: ${issue.message}`
        : `Invalid upload request: ${field} is not valid.`;
}

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export async function readAssetBytes(db: NeonHttpDatabase, boardId: number, assetId: string) {
    const result = await db.execute(sql`
        SELECT a.mime_type, string_agg(c.bytes, ''::bytea ORDER BY c.chunk_index) AS bytes
        FROM assets a JOIN asset_chunks c ON c.board_id = a.board_id AND c.asset_id = a.asset_id
        WHERE a.board_id = ${boardId} AND a.asset_id = ${assetId}
        GROUP BY a.mime_type`);
    const row = result.rows[0] as { mime_type: string; bytes: Buffer | string } | undefined;
    if (!row) {
        return null;
    }
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

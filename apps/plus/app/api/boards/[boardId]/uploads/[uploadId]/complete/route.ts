import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_assets, db_uploadSessions } from "@/lib/db/schema";
import { editorFromRequest, editorSessionGuard } from "@/lib/editor-guard";

type Context = { params: Promise<{ boardId: string; uploadId: string }> };
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: Context) {
    const { boardId: rawBoardId, uploadId } = await params;
    const boardId = Number(rawBoardId);
    const gate = await editorFromRequest(request, boardId);
    if (!gate.identity) return gate.failure;

    const db = getDb();
    const [session] = await db.select().from(db_uploadSessions)
        .where(and(eq(db_uploadSessions.uploadId, uploadId), eq(db_uploadSessions.boardId, boardId))).limit(1);
    if (!session || session.userId !== gate.identity.userId) {
        return NextResponse.json({ message: "This upload does not exist." }, { status: 404 });
    }

    const result = await db.execute(sql`
        WITH parts AS (
            SELECT count(*)::int AS chunk_count,
                coalesce(sum(length(bytes)), 0)::bigint AS byte_length,
                coalesce(max(chunk_index), -1) AS last_index,
                encode(sha256(coalesce(string_agg(bytes, ''::bytea ORDER BY chunk_index), ''::bytea)), 'hex') AS digest
            FROM asset_chunks WHERE board_id = ${boardId} AND asset_id = ${session.assetId}
        )
        INSERT INTO assets (board_id, asset_id, digest, byte_length, mime_type, chunk_size, chunk_count)
        SELECT ${boardId}, ${session.assetId}, ${session.digest}, ${session.byteLength}, ${session.mimeType},
            ${session.chunkSize}, ${session.chunkCount}
        FROM parts p
        WHERE p.chunk_count = ${session.chunkCount} AND p.last_index = ${session.chunkCount - 1}
            AND p.byte_length = ${session.byteLength} AND p.digest = ${session.digest}
            AND ${editorSessionGuard(gate.identity)}
        ON CONFLICT (board_id, asset_id) DO NOTHING
        RETURNING asset_id`);

    if (!result.rows.length) {
        const [stored] = await db.select().from(db_assets)
            .where(and(eq(db_assets.boardId, boardId), eq(db_assets.assetId, session.assetId))).limit(1);
        if (!stored || stored.digest !== session.digest) {
            return NextResponse.json(
                { message: "The uploaded chunks are incomplete or do not match the checksum." }, { status: 409 });
        }
    }

    await db.delete(db_uploadSessions).where(eq(db_uploadSessions.uploadId, uploadId));
    return NextResponse.json({ ok: true, assetId: session.assetId, complete: true });
}

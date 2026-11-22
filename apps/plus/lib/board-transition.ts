import { eq, sql } from "drizzle-orm";
import type { BoardInfo, BoardSnapshot } from "@meldrift/board-data/board-state";
import { getDb } from "./db";
import {
    db_boardSnapshots, db_boardSync, db_drawingStrokes, db_images, db_memos, db_mermaids, db_tables,
} from "./db/schema";
import { loadSavedBoardSnapshot } from "./saved-board-snapshot";
import { loadBoardState } from "./board-state-store";
import { storeBoardAsset } from "./assets";

export class TransitionError extends Error {}

export type TransitionReport = {
    source: "snapshot" | "tables";
    revision: number;
    counts: Record<"memos" | "images" | "mermaids" | "tables" | "strokes", number>;
    assets: number;
};

const countsOf = (snapshot: BoardSnapshot) => ({
    memos: snapshot.memos.length,
    images: snapshot.images.length,
    mermaids: snapshot.mermaids.length,
    tables: snapshot.tables.length,
    strokes: snapshot.strokes.length,
});

async function replaceTables(board: BoardInfo, snapshot: BoardSnapshot) {
    const db = getDb();
    const boardId = board.boardId;
    await db.batch([
        db.delete(db_memos).where(eq(db_memos.boardId, boardId)),
        db.delete(db_images).where(eq(db_images.boardId, boardId)),
        db.delete(db_mermaids).where(eq(db_mermaids.boardId, boardId)),
        db.delete(db_tables).where(eq(db_tables.boardId, boardId)),
        db.delete(db_drawingStrokes).where(eq(db_drawingStrokes.boardId, boardId)),
    ]);

    if (snapshot.memos.length > 0) {
        await db.insert(db_memos).values(snapshot.memos.map((memo) => ({
            boardId, syncId: memo.syncId, content: memo.content, color: memo.color, sortOrder: memo.sortOrder,
            x: memo.x, y: memo.y, z: memo.z, width: memo.width, height: memo.height,
        })));
    }
    if (snapshot.mermaids.length > 0) {
        await db.insert(db_mermaids).values(snapshot.mermaids.map((card) => ({
            boardId, syncId: card.syncId, source: card.source,
            x: card.x, y: card.y, z: card.z, width: card.width, height: card.height,
        })));
    }
    if (snapshot.tables.length > 0) {
        await db.insert(db_tables).values(snapshot.tables.map((card) => ({
            boardId, syncId: card.syncId, source: card.source,
            x: card.x, y: card.y, z: card.z, width: card.width, height: card.height,
        })));
    }
    if (snapshot.images.length > 0) {
        await db.insert(db_images).values(snapshot.images.map((image) => ({
            boardId, syncId: image.syncId, assetId: image.assetId || null,
            publicId: null, secureUrl: image.data && image.assetId ? null : image.url || null, fileName: image.label,
            x: image.x, y: image.y, z: image.z, width: image.width, height: image.height,
        })));
    }
    for (const stroke of snapshot.strokes) {
        await db.insert(db_drawingStrokes).values({
            boardId, syncId: stroke.id, color: stroke.color, width: stroke.width, points: stroke.points,
        });
    }
}

export async function transitionBoard(board: BoardInfo): Promise<TransitionReport> {
    const db = getDb();
    const boardId = board.boardId;
    const [current] = await db.select().from(db_boardSync).where(eq(db_boardSync.boardId, boardId)).limit(1);
    if (current?.mode === "delta") {
        throw new TransitionError("This board already stores changes. Rolling back to a snapshot is not allowed.");
    }

    const saved = await loadSavedBoardSnapshot(boardId);
    const [snapshotRow] = await db.select().from(db_boardSnapshots)
        .where(eq(db_boardSnapshots.boardId, boardId)).limit(1);
    const revision = snapshotRow?.revision ?? current?.revision ?? 0;
    const source = saved ? "snapshot" : "tables";
    const original = saved ?? await loadBoardState(board);

    await db.execute(sql`
        INSERT INTO board_sync (board_id, revision, mode) VALUES (${boardId}, ${revision}, 'migrating')
        ON CONFLICT (board_id) DO UPDATE SET mode = 'migrating', updated_at = now()`);

    const digests = new Map<string, string>();
    if (saved) {
        await replaceTables(board, saved);
        for (const image of saved.images) {
            if (!image.data || !image.assetId) {
                continue;
            }
            digests.set(image.assetId, await storeBoardAsset(
                boardId, image.assetId, image.data, image.mimeType ?? "application/octet-stream"));
        }
    }

    const moved = await loadBoardState(board);
    const expected = countsOf(original);
    const actual = countsOf(moved);
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        if (expected[key] !== actual[key]) {
            throw new TransitionError(`Moved ${actual[key]} ${key} but the source had ${expected[key]}.`);
        }
    }

    for (const [assetId, digest] of digests) {
        const [stored] = (await db.execute(sql`
            SELECT a.digest AS declared, a.byte_length,
                encode(sha256(coalesce(string_agg(c.bytes, ''::bytea ORDER BY c.chunk_index), ''::bytea)), 'hex') AS actual,
                coalesce(sum(length(c.bytes)), 0)::bigint AS stored_length
            FROM assets a LEFT JOIN asset_chunks c ON c.board_id = a.board_id AND c.asset_id = a.asset_id
            WHERE a.board_id = ${boardId} AND a.asset_id = ${assetId}
            GROUP BY a.digest, a.byte_length`)).rows as
            { declared: string; byte_length: number; actual: string; stored_length: string }[];
        if (!stored || stored.declared !== digest || stored.actual !== digest
            || Number(stored.stored_length) !== stored.byte_length) {
            throw new TransitionError(`The stored bytes for ${assetId} do not match the source image.`);
        }
    }

    await db.execute(sql`
        UPDATE board_sync SET mode = 'delta', revision = ${revision}, updated_at = now()
        WHERE board_id = ${boardId} AND mode = 'migrating'`);

    return { source, revision, counts: actual, assets: digests.size };
}

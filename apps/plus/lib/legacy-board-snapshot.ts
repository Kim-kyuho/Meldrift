import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { db_memos, db_images, db_mermaids, db_tables, db_drawings } from "./db/schema";
import type { BoardInfo, BoardSnapshot } from "@meldrift/board/board-state";
import { rankMemoOrders } from "@meldrift/core/memo-order";

export async function loadLegacySnapshot(board: BoardInfo): Promise<BoardSnapshot> {
    const db = getDb();
    const [memos, images, mermaids, tables, drawings] = await Promise.all([
        db.select().from(db_memos).where(eq(db_memos.boardId, board.boardId)),
        db.select().from(db_images).where(eq(db_images.boardId, board.boardId)),
        db.select().from(db_mermaids).where(eq(db_mermaids.boardId, board.boardId)),
        db.select().from(db_tables).where(eq(db_tables.boardId, board.boardId)),
        db.select().from(db_drawings).where(eq(db_drawings.boardId, board.boardId)),
    ]);
    const orders = rankMemoOrders(memos.map((memo) => ({ id: memo.id, storedOrder: memo.sortOrder })));
    return {
        board,
        memos: memos.map((memo) => ({ ...memo, sortOrder: orders.get(memo.id) ?? 1 })),
        images: images.map((image) => ({
            ...image, url: image.secureUrl, label: image.fileName, data: null, mimeType: null,
        })),
        mermaids: mermaids.map((card) => ({ ...card, id: card.mermaidId })),
        tables: tables.map((card) => ({ ...card, id: card.tableId })),
        strokes: drawings[0]?.source ?? [],
    };
}

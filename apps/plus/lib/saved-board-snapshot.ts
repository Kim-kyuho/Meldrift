import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { db_boardSnapshots } from "./db/schema";
import { decodeSnapshot } from "./snapshot-codec";

export async function loadSavedBoardSnapshot(boardId: number) {
    const [saved] = await getDb().select().from(db_boardSnapshots)
        .where(eq(db_boardSnapshots.boardId, boardId)).limit(1);
    return saved ? decodeSnapshot(new Uint8Array(saved.snapshot), boardId) : null;
}

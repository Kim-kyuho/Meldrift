import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_boards, db_boardSync } from "@/lib/db/schema";
import { loadSavedBoardSnapshot } from "@/lib/saved-board-snapshot";
import { loadBoardState } from "@/lib/board-state-store";

export async function GET(_request: Request, { params }: { params: Promise<{ boardId: string }> }) {
    const boardId = Number((await params).boardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0) {
        return NextResponse.json({ ok: false, message: "Invalid board id." }, { status: 400 });
    }

    const db = getDb();
    const [board] = await db.select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);
    if (!board) {
        return NextResponse.json({ ok: false, message: "This board does not exist." }, { status: 404 });
    }

    const [sync] = await db.select().from(db_boardSync).where(eq(db_boardSync.boardId, boardId)).limit(1);
    const mode = sync?.mode ?? "snapshot";
    const info = { boardId: board.boardId, title: board.title, width: board.width, height: board.height };
    const fromTables = mode === "delta";
    const snapshot = fromTables
        ? await loadBoardState(info)
        : await loadSavedBoardSnapshot(boardId) ?? await loadBoardState(info);

    return NextResponse.json({
        ok: true,
        mode,
        revision: sync?.revision ?? 0,
        snapshot: {
            ...snapshot,
            images: snapshot.images.map((image) => ({
                ...image,
                url: image.url || (fromTables ? "" : `/api/boards/${boardId}/snapshot/images/${image.imageId}`),
                data: null,
                mimeType: null,
            })),
        },
    }, { headers: { "Cache-Control": "no-store" } });
}

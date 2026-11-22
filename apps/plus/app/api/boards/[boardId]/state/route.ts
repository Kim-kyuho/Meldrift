import { boardAccess } from "@/lib/board-access";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_boardSync } from "@/lib/db/schema";
import { loadSavedBoardSnapshot } from "@/lib/saved-board-snapshot";
import { loadBoardState } from "@/lib/board-state-store";

export async function GET(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
    const boardId = Number((await params).boardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0) {
        return NextResponse.json({ ok: false, message: "Invalid board id." }, { status: 400 });
    }

    const db = getDb();
    const gate = await boardAccess(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    const { board } = gate;

    const [sync] = await db.select().from(db_boardSync).where(eq(db_boardSync.boardId, boardId)).limit(1);
    const mode = sync?.mode ?? "snapshot";
    const info = { boardId: board.boardId, title: board.title, width: board.width, height: board.height };
    const saved = mode === "delta" ? null : await loadSavedBoardSnapshot(boardId);
    const snapshot = saved ?? await loadBoardState(info);

    return NextResponse.json({
        ok: true,
        mode,
        revision: sync?.revision ?? 0,
        snapshot: {
            ...snapshot,
            images: snapshot.images.map((image) => ({
                ...image,
                url: saved ? `/api/boards/${boardId}/snapshot/images/${image.imageId}` : image.url,
                data: null,
                mimeType: null,
            })),
        },
    }, { headers: { "Cache-Control": "no-store" } });
}

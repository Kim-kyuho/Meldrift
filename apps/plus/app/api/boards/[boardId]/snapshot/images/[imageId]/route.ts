import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_boards } from "@/lib/db/schema";
import { loadSavedBoardSnapshot } from "@/lib/saved-board-snapshot";

export async function GET(_request: Request, { params }: { params: Promise<{ boardId: string; imageId: string }> }) {
    const ids = await params;
    const boardId = Number(ids.boardId);
    const imageId = Number(ids.imageId);
    if (![boardId, imageId].every((id) => Number.isSafeInteger(id) && id > 0)) return new NextResponse(null, { status: 404 });
    const [board] = await getDb().select({ boardId: db_boards.boardId }).from(db_boards)
        .where(eq(db_boards.boardId, boardId)).limit(1);
    if (!board) return new NextResponse(null, { status: 404 });
    const snapshot = await loadSavedBoardSnapshot(boardId);
    const image = snapshot?.images.find((image) => image.imageId === imageId);
    if (!image?.data || !image.mimeType) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(image.data), { headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
}

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_assetChunks } from "@/lib/db/schema";
import { assetIdPattern } from "@/lib/assets";

type Context = { params: Promise<{ boardId: string; assetId: string; index: string }> };

export async function GET(_request: Request, { params }: Context) {
    const { boardId: rawBoardId, assetId, index: rawIndex } = await params;
    const boardId = Number(rawBoardId);
    const index = Number(rawIndex);
    if (!Number.isSafeInteger(boardId) || boardId <= 0 || !assetIdPattern.test(assetId)
        || !Number.isSafeInteger(index) || index < 0) {
        return new NextResponse(null, { status: 400 });
    }

    const [chunk] = await getDb().select().from(db_assetChunks).where(and(
        eq(db_assetChunks.boardId, boardId),
        eq(db_assetChunks.assetId, assetId),
        eq(db_assetChunks.chunkIndex, index),
    )).limit(1);
    if (!chunk) return new NextResponse(null, { status: 404 });

    return new NextResponse(new Uint8Array(chunk.bytes), {
        headers: {
            "Content-Type": "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "no-store",
        },
    });
}

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_uploadSessions } from "@/lib/db/schema";
import { editorFromRequest } from "@/lib/editor-guard";
import { receivedChunks } from "@/lib/assets";

type Context = { params: Promise<{ boardId: string; uploadId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
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

    return NextResponse.json({
        ok: true,
        uploadId,
        assetId: session.assetId,
        chunkSize: session.chunkSize,
        chunkCount: session.chunkCount,
        expired: session.expiresAt.getTime() <= Date.now(),
        received: await receivedChunks(db, boardId, session.assetId),
    }, { headers: { "Cache-Control": "no-store" } });
}

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_assets } from "@/lib/db/schema";
import { assetIdPattern } from "@/lib/assets";

type Context = { params: Promise<{ boardId: string; assetId: string }> };

export async function GET(_request: Request, { params }: Context) {
    const { boardId: rawBoardId, assetId } = await params;
    const boardId = Number(rawBoardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0 || !assetIdPattern.test(assetId)) {
        return NextResponse.json({ message: "Invalid asset request." }, { status: 400 });
    }

    const [asset] = await getDb().select().from(db_assets)
        .where(and(eq(db_assets.boardId, boardId), eq(db_assets.assetId, assetId))).limit(1);
    if (!asset) {
        return NextResponse.json({ message: "This asset does not exist." }, { status: 404 });
    }

    return NextResponse.json({
        ok: true,
        assetId: asset.assetId,
        digest: asset.digest,
        byteLength: asset.byteLength,
        mimeType: asset.mimeType,
        chunkSize: asset.chunkSize,
        chunkCount: asset.chunkCount,
    }, { headers: { "Cache-Control": "no-store" } });
}

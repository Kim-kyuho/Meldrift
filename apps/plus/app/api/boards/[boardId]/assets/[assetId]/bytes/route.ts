import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { assetIdPattern } from "@/lib/assets";

type Context = { params: Promise<{ boardId: string; assetId: string }> };

export async function GET(_request: Request, { params }: Context) {
    const { boardId: rawBoardId, assetId } = await params;
    const boardId = Number(rawBoardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0 || !assetIdPattern.test(assetId)) {
        return new NextResponse(null, { status: 400 });
    }

    const result = await getDb().execute(sql`
        SELECT a.mime_type, string_agg(c.bytes, ''::bytea ORDER BY c.chunk_index) AS bytes
        FROM assets a JOIN asset_chunks c ON c.board_id = a.board_id AND c.asset_id = a.asset_id
        WHERE a.board_id = ${boardId} AND a.asset_id = ${assetId}
        GROUP BY a.mime_type`);
    const row = result.rows[0] as { mime_type: string; bytes: Buffer | string } | undefined;
    if (!row) return new NextResponse(null, { status: 404 });

    const bytes = typeof row.bytes === "string"
        ? Buffer.from(row.bytes.replace(/^\\x/, ""), "hex")
        : Buffer.from(row.bytes);

    return new NextResponse(new Uint8Array(bytes), {
        headers: {
            "Content-Type": row.mime_type,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "no-store",
        },
    });
}

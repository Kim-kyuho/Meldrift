import { boardAccess } from "@/lib/board-access";
import { boardPreviewUrl } from "@/lib/board-preview";
import { getDb } from "@/lib/db";
import { db_boardPreviews } from "@/lib/db/schema";
import { editorFromRequest, editorSessionGuard } from "@/lib/editor-guard";
import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Context = { params: Promise<{ boardId: string }> };
const maxPreviewSize = 4 * 1024 * 1024;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    const gate = await boardAccess(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }

    const [preview] = await getDb().select().from(db_boardPreviews)
        .where(eq(db_boardPreviews.boardId, boardId)).limit(1);
    if (preview) {
        return new NextResponse(new Uint8Array(preview.bytes), {
            headers: { ...headers, "Content-Type": preview.mimeType },
        });
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (gate.board.privateFlg === 0 && gate.board.previewVersion && cloudName) {
        return NextResponse.redirect(boardPreviewUrl(cloudName, boardId, gate.board.previewVersion), { headers });
    }
    return new NextResponse(null, { status: 404, headers });
}

export async function PUT(request: NextRequest, { params }: Context) {
    try {
        const boardId = Number((await params).boardId);
        const gate = await editorFromRequest(request, boardId);
        if (gate.failure) {
            return gate.failure;
        }

        if (Number(request.headers.get("Content-Length")) > maxPreviewSize + 4096) {
            return NextResponse.json({ ok: false, message: "The preview exceeds 4 MiB." }, { status: 413 });
        }
        const file = (await request.formData().catch(() => null))?.get("file");
        if (!(file instanceof File) || !file.size || !["image/png", "image/webp"].includes(file.type)) {
            return NextResponse.json({ ok: false, message: "A PNG or WebP preview is required." }, { status: 400 });
        }
        if (file.size > maxPreviewSize) {
            return NextResponse.json({ ok: false, message: "The preview exceeds 4 MiB." }, { status: 413 });
        }
        const bytes = Buffer.from(await file.arrayBuffer()).toString("hex");
        const updated = await getDb().execute(sql`
            INSERT INTO board_previews (board_id, bytes, mime_type)
            SELECT ${boardId}, decode(${bytes}, 'hex'), ${file.type}
            WHERE ${editorSessionGuard(gate.identity, boardId)}
            ON CONFLICT (board_id) DO UPDATE SET bytes = excluded.bytes, mime_type = excluded.mime_type
            RETURNING board_id
        `);
        if (!updated.rows.length) {
            return NextResponse.json({ ok: false, message: "Your permissions changed." }, { status: 403 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error saving board preview:", error);
        return NextResponse.json({ ok: false, message: "The preview could not be saved." }, { status: 500 });
    }
}

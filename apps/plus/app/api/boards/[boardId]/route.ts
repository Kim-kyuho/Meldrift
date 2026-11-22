import { configureLegacyImageStorage } from "@/lib/board-preview-store";
import { boardPreviewPublicId } from "@/lib/board-preview";
import { BoardPrivacyError, prepareBoardPrivacy } from "@/lib/board-privacy";
import { getDb } from "@/lib/db";
import {
    db_assetChunks, db_assets, db_boards, db_boardSnapshots, db_boardSync, db_drawings, db_drawingStrokes,
    db_images, db_memos, db_mermaids, db_syncMutations, db_tables, db_uploadSessions,
} from "@/lib/db/schema";
import { managerFromRequest, managerSessionGuard } from "@/lib/editor-guard";
import { membershipLock } from "@/lib/membership-guard";
import { v2 as cloudinary } from "cloudinary";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Context = { params: Promise<{ boardId: string }> };
export const maxDuration = 60;
const boardUpdates = z.object({
    title: z.string().trim().min(1).max(200).optional(),
    privateFlg: z.union([z.literal(0), z.literal(1)]).optional(),
    collabFlg: z.union([z.literal(0), z.literal(1)]).optional(),
}).strict().refine((data) => data.title !== undefined || data.privateFlg !== undefined || data.collabFlg !== undefined);

export async function PATCH(request: NextRequest, { params }: Context) {
    try {
        const boardId = Number((await params).boardId);
        const gate = await managerFromRequest(request, boardId);
        if (gate.failure) {
            return gate.failure;
        }

        const parsed = boardUpdates.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ ok: false, message: "Invalid board title, visibility, or collaboration." }, { status: 400 });
        }

        const updates: Partial<typeof db_boards.$inferInsert> = { ...parsed.data, updatedAt: new Date() };
        if (updates.privateFlg === 1 && (gate.board.privateFlg === 0 || gate.board.previewVersion !== null)) {
            await prepareBoardPrivacy(boardId, gate.board.previewVersion !== null);
            updates.previewVersion = null;
        }

        const db = getDb();
        const [, [board]] = await db.batch([
            db.execute(membershipLock),
            db.update(db_boards).set(updates).where(and(
                eq(db_boards.boardId, boardId),
                managerSessionGuard(gate.identity, boardId),
            )).returning({
                boardId: db_boards.boardId, title: db_boards.title,
                privateFlg: db_boards.privateFlg, collabFlg: db_boards.collabFlg,
            }),
        ]);
        if (!board) {
            return NextResponse.json({ ok: false, message: "Your permissions changed." }, { status: 403 });
        }
        if (parsed.data.privateFlg !== undefined && parsed.data.privateFlg !== gate.board.privateFlg) {
            console.info("board.visibility_changed", { actor: gate.identity.userId, boardId, privateFlg: parsed.data.privateFlg });
        }
        return NextResponse.json({ ok: true, board });
    } catch (error) {
        if (error instanceof BoardPrivacyError) {
            return NextResponse.json({ ok: false, message: error.message }, { status: 503 });
        }
        console.error("Error updating board:", error);
        return NextResponse.json({ ok: false, message: "The board could not be updated." }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Context) {
    try {
        const boardId = Number((await params).boardId);
        const gate = await managerFromRequest(request, boardId);
        if (gate.failure) {
            return gate.failure;
        }

        const db = getDb();
        const guard = managerSessionGuard(gate.identity, boardId);
        const images = await db.select({ publicId: db_images.publicId }).from(db_images).where(eq(db_images.boardId, boardId));
        const legacyIds = images.flatMap(({ publicId }) => publicId ? [publicId] : []);
        if (gate.board.previewVersion !== null) {
            legacyIds.push(boardPreviewPublicId(boardId));
        }
        if (legacyIds.length && !configureLegacyImageStorage()) {
            return NextResponse.json({ ok: false, message: "Legacy image storage is not configured." }, { status: 500 });
        }

        const results = await db.batch([
            db.execute(membershipLock),
            db.execute(sql`SELECT id FROM users WHERE id = ${gate.identity.userId} FOR UPDATE`),
            db.execute(sql`SELECT board_id FROM boards WHERE board_id = ${boardId} FOR UPDATE`),
            db.delete(db_boardSnapshots).where(and(eq(db_boardSnapshots.boardId, boardId), guard)),
            db.delete(db_images).where(and(eq(db_images.boardId, boardId), guard)),
            db.delete(db_memos).where(and(eq(db_memos.boardId, boardId), guard)),
            db.delete(db_mermaids).where(and(eq(db_mermaids.boardId, boardId), guard)),
            db.delete(db_drawings).where(and(eq(db_drawings.boardId, boardId), guard)),
            db.delete(db_tables).where(and(eq(db_tables.boardId, boardId), guard)),
            db.delete(db_drawingStrokes).where(and(eq(db_drawingStrokes.boardId, boardId), guard)),
            db.delete(db_assetChunks).where(and(eq(db_assetChunks.boardId, boardId), guard)),
            db.delete(db_assets).where(and(eq(db_assets.boardId, boardId), guard)),
            db.delete(db_uploadSessions).where(and(eq(db_uploadSessions.boardId, boardId), guard)),
            db.delete(db_boardSync).where(and(eq(db_boardSync.boardId, boardId), guard)),
            db.delete(db_syncMutations).where(and(eq(db_syncMutations.boardId, boardId), guard)),
            db.delete(db_boards).where(and(eq(db_boards.boardId, boardId), guard)).returning({ boardId: db_boards.boardId }),
        ]);
        const deleted = results.at(-1);
        const board = Array.isArray(deleted) ? deleted[0] : undefined;
        if (!board) {
            return NextResponse.json({ ok: false, message: "Your permissions changed." }, { status: 403 });
        }

        const cleanup = await Promise.allSettled(legacyIds.map((id) => cloudinary.uploader.destroy(id, { invalidate: true })));
        if (cleanup.some((result) => result.status === "rejected"
            || (result.value.result !== "ok" && result.value.result !== "not found"))) {
            console.error("Could not remove one or more legacy images for board", boardId);
        }
        return NextResponse.json({ ok: true, board });
    } catch (error) {
        console.error("Error deleting board:", error);
        return NextResponse.json({ ok: false, message: "The board could not be deleted." }, { status: 500 });
    }
}

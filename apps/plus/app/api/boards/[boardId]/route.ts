import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_boards, db_drawings, db_images, db_memos, db_mermaids, db_tables } from "@/lib/db/schema";
import { v2 as cloudinary } from "cloudinary";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);

        if (currentUser?.role !== "admin") {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Only administrators can rename boards.",
                },
                { status: 403 },
            );
        }

        const db = getDb();
        const boardId = Number((await params).boardId);
        const body = await request.json();
        const updates: Partial<typeof db_boards.$inferInsert> = {};

        if (!Number.isInteger(boardId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid board id.",
                },
                { status: 400 },
            );
        }
        if (body.boardId !== undefined) {
            updates.boardId = body.boardId;
        }
        if (body.title !== undefined) {
            updates.title = body.title;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No update fields were provided.",
                },
                { status: 400 },
            );
        }

        const updatedBoard = await db.update(db_boards).set(updates).where(eq(db_boards.boardId, boardId)).returning();

        return NextResponse.json(
            {
                ok: true,
                board: updatedBoard[0],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error updating board:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while updating the board.",
            },
            { status: 500 },
        );
    }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);

        if (currentUser?.role !== "admin") {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Only administrators can delete boards.",
                },
                { status: 403 },
            );
        }

        const boardId = Number((await params).boardId);

        if (!Number.isInteger(boardId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid board id.",
                },
                { status: 400 },
            );
        }

        const db = getDb();
        const targetBoard = await db.select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);

        if (!targetBoard[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "This board does not exist.",
                },
                { status: 404 },
            );
        }

        if (
            !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Cloudinary environment variables are not set.",
                },
                { status: 500 },
            );
        }

        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const boardImages = await db
            .select({
                publicId: db_images.publicId,
            })
            .from(db_images)
            .where(eq(db_images.boardId, boardId));

        const previewPublicId = `kyuboard/boards/${boardId}/PreviewIMG`;

        await Promise.all([
            ...boardImages.map((image) => cloudinary.uploader.destroy(image.publicId)),
            cloudinary.uploader.destroy(previewPublicId, { invalidate: true }),
        ]);

        await db.delete(db_images).where(eq(db_images.boardId, boardId));

        await db.delete(db_memos).where(eq(db_memos.boardId, boardId));

        await db.delete(db_mermaids).where(eq(db_mermaids.boardId, boardId));

        await db.delete(db_drawings).where(eq(db_drawings.boardId, boardId));

        await db.delete(db_tables).where(eq(db_tables.boardId, boardId));

        const deletedBoard = await db.delete(db_boards).where(eq(db_boards.boardId, boardId)).returning();

        return NextResponse.json({
            ok: true,
            board: deletedBoard[0],
        });
    } catch (error) {
        console.error("Error deleting board:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while deleting the board.",
            },
            { status: 500 },
        );
    }
}

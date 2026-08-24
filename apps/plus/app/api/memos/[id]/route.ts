import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_memos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);

        if (permissionMessage) {
            return NextResponse.json(
                {
                    ok: false,
                    message: permissionMessage,
                },
                { status: 403 },
            );
        }

        const db = getDb();
        const body = await request.json();
        const updates: Partial<typeof db_memos.$inferInsert> = {};
        const memoId = Number((await params).id);
        if (!Number.isInteger(memoId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid memo id.",
                },
                { status: 400 },
            );
        }
        if (body.boardId !== undefined) updates.boardId = body.boardId;
        if (body.content !== undefined) updates.content = body.content;
        if (body.x !== undefined) updates.x = body.x;
        if (body.y !== undefined) updates.y = body.y;
        if (body.z !== undefined) updates.z = body.z;
        if (body.width !== undefined) updates.width = body.width;
        if (body.height !== undefined) updates.height = body.height;
        if (body.color !== undefined) updates.color = body.color;
        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No update fields were provided.",
                },
                { status: 400 },
            );
        }
        const updatedMemo = await db.update(db_memos).set(updates).where(eq(db_memos.id, memoId)).returning();

        if (!updatedMemo[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Memo does not exist.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
        console.error("Error updating memo:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while updating the memo.",
            },
            { status: 500 },
        );
    }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);

        if (permissionMessage) {
            return NextResponse.json(
                {
                    ok: false,
                    message: permissionMessage,
                },
                { status: 403 },
            );
        }

        const db = getDb();
        const memoId = Number((await params).id);
        if (!Number.isInteger(memoId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid memo id.",
                },
                { status: 400 },
            );
        }
        const deletedMemo = await db.delete(db_memos).where(eq(db_memos.id, memoId)).returning();

        if (!deletedMemo[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Memo does not exist.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                ok: true,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error deleting memo:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while deleting the memo.",
            },
            { status: 500 },
        );
    }
}

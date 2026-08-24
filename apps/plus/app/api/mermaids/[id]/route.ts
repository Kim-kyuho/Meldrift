import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_mermaids } from "@/lib/db/schema";
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
        const updates: Partial<typeof db_mermaids.$inferInsert> = {};
        const mermaidId = Number((await params).id);

        if (!Number.isInteger(mermaidId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid mermaid id.",
                },
                { status: 400 },
            );
        }

        if (body.boardId !== undefined) updates.boardId = body.boardId;
        if (body.source !== undefined) updates.source = body.source;
        if (body.x !== undefined) updates.x = body.x;
        if (body.y !== undefined) updates.y = body.y;
        if (body.z !== undefined) updates.z = body.z;
        if (body.width !== undefined) updates.width = body.width;
        if (body.height !== undefined) updates.height = body.height;

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No update fields were provided.",
                },
                { status: 400 },
            );
        }

        const updatedMermaid = await db
            .update(db_mermaids)
            .set(updates)
            .where(eq(db_mermaids.mermaidId, mermaidId))
            .returning();

        if (!updatedMermaid[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Mermaid does not exist.",
                },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                ok: true,
                mermaid: updatedMermaid[0],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error updating mermaid:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while updating the mermaid.",
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
        const mermaidId = Number((await params).id);

        if (!Number.isInteger(mermaidId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid mermaid id.",
                },
                { status: 400 },
            );
        }

        const deletedMermaid = await db.delete(db_mermaids).where(eq(db_mermaids.mermaidId, mermaidId)).returning();

        if (!deletedMermaid[0]) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Mermaid does not exist.",
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
        console.error("Error deleting mermaid:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while deleting the mermaid.",
            },
            { status: 500 },
        );
    }
}

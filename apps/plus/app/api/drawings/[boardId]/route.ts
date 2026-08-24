import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_drawings } from "@/lib/db/schema";
import { boardStrokesSchema } from "@/lib/board-stroke";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
    try {
        const boardId = Number((await params).boardId);

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid board id.",
                },
                { status: 400 },
            );
        }

        const db = getDb();
        const boardDrawings = await db
            .select({ source: db_drawings.source })
            .from(db_drawings)
            .where(eq(db_drawings.boardId, boardId))
            .limit(1);

        return NextResponse.json(
            {
                ok: true,
                strokes: boardDrawings[0]?.source ?? [],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error fetching board strokes:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while fetching the board strokes.",
            },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
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

        const boardId = Number((await params).boardId);

        if (!Number.isInteger(boardId) || boardId <= 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid board id.",
                },
                { status: 400 },
            );
        }

        const body = await request.json();
        const parsedStrokes = boardStrokesSchema.safeParse(body.strokes);

        if (!parsedStrokes.success) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid stroke data.",
                },
                { status: 400 },
            );
        }

        const db = getDb();
        await db
            .insert(db_drawings)
            .values({
                boardId,
                source: parsedStrokes.data,
            })
            .onConflictDoUpdate({
                target: db_drawings.boardId,
                set: {
                    source: parsedStrokes.data,
                    updatedAt: new Date(),
                },
            });

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
        console.error("Error saving board strokes:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while saving the board strokes.",
            },
            { status: 500 },
        );
    }
}

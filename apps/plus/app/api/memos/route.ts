import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_memos } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
        if (
            !Number.isInteger(body.boardId) ||
            body.boardId <= 0 ||
            typeof body.content !== "string" ||
            !Number.isFinite(body.x) ||
            !Number.isFinite(body.y) ||
            !Number.isFinite(body.z) ||
            !Number.isFinite(body.width) ||
            !Number.isFinite(body.height) ||
            body.width <= 0 ||
            body.height <= 0 ||
            typeof body.color !== "string" ||
            !body.color.trim()
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid request body.",
                },
                { status: 400 },
            );
        }

        const newMemo = await db
            .insert(db_memos)
            .values({
                boardId: body.boardId,
                content: body.content,
                x: body.x,
                y: body.y,
                z: body.z,
                width: body.width,
                height: body.height,
                color: body.color,
            })
            .returning();

        return NextResponse.json(
            {
                ok: true,
                memo: newMemo[0],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error creating memo:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while creating the memo.",
            },
            { status: 500 },
        );
    }
}

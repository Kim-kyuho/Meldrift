import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_mermaids } from "@/lib/db/schema";
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
            typeof body.source !== "string" ||
            !body.source.trim() ||
            !Number.isFinite(body.x) ||
            !Number.isFinite(body.y) ||
            !Number.isFinite(body.z) ||
            !Number.isFinite(body.width) ||
            !Number.isFinite(body.height) ||
            body.width <= 0 ||
            body.height <= 0
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid request body.",
                },
                { status: 400 },
            );
        }

        const newMermaid = await db
            .insert(db_mermaids)
            .values({
                boardId: body.boardId,
                source: body.source,
                x: body.x,
                y: body.y,
                z: body.z,
                width: body.width,
                height: body.height,
            })
            .returning();

        return NextResponse.json(
            {
                ok: true,
                mermaid: newMermaid[0],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error creating mermaid:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while creating the mermaid.",
            },
            { status: 500 },
        );
    }
}

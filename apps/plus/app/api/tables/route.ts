import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_tables } from "@/lib/db/schema";
import { tableSourceSchema } from "@/lib/table-card";
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

        const body = await request.json();
        const parsedSource = tableSourceSchema.safeParse(body.source);

        if (
            !Number.isInteger(body.boardId) ||
            body.boardId <= 0 ||
            !parsedSource.success ||
            !Number.isInteger(body.x) ||
            !Number.isInteger(body.y) ||
            !Number.isInteger(body.z) ||
            !Number.isInteger(body.width) ||
            !Number.isInteger(body.height) ||
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

        const db = getDb();
        const newTable = await db
            .insert(db_tables)
            .values({
                boardId: body.boardId,
                source: parsedSource.data,
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
                table: newTable[0],
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Error creating table:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while creating the table.",
            },
            { status: 500 },
        );
    }
}

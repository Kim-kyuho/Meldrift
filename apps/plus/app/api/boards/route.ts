import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_boards } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (currentUser?.role !== "admin") {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Only administrators can create boards.",
                },
                { status: 403 },
            );
        }

        const body = await request.json();
        const title = String(body.title ?? "").trim();
        const width = Number(body.width);
        const height = Number(body.height);
        const ownerId = String(body.ownerId).trim();

        if (!title || !Number.isInteger(width) || !Number.isInteger(height) || !ownerId) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Board title and size are required.",
                },
                { status: 400 },
            );
        }

        const db = getDb();
        const now = new Date();
        const newBoard = await db
            .insert(db_boards)
            .values({
                title,
                width,
                height,
                ownerId,
                createdAt: now,
            })
            .returning();

        return NextResponse.json(
            {
                ok: true,
                board: newBoard[0],
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error creating board:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while creating the board.",
            },
            { status: 500 },
        );
    }
}

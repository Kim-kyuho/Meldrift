import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { db_boards } from "@/lib/db/schema";
import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { TransitionError, transitionBoard } from "@/lib/board-transition";

type Context = { params: Promise<{ boardId: string }> };
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: Context) {
    const user = await getCurrentUserFromRequest(request);
    if (user?.role !== "admin") {
        return NextResponse.json({ ok: false, message: "Only an administrator can move a board." }, { status: 403 });
    }

    const boardId = Number((await params).boardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0) {
        return NextResponse.json({ ok: false, message: "Invalid board id." }, { status: 400 });
    }

    const [board] = await getDb().select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);
    if (!board) {
        return NextResponse.json({ ok: false, message: "This board does not exist." }, { status: 404 });
    }

    try {
        const report = await transitionBoard({
            boardId: board.boardId, title: board.title, width: board.width, height: board.height,
        });
        return NextResponse.json({ ok: true, ...report });
    } catch (error) {
        if (error instanceof TransitionError) {
            return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
        }
        console.error("Error moving board to change sync:", error);
        return NextResponse.json({ ok: false, message: "The board could not be moved." }, { status: 500 });
    }
}

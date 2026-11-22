import { NextRequest, NextResponse } from "next/server";
import { boardAccess } from "@/lib/board-access";
import { TransitionError, transitionBoard } from "@/lib/board-transition";

type Context = { params: Promise<{ boardId: string }> };
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    const gate = await boardAccess(request, boardId, "edit");
    if (gate.failure) {
        return gate.failure;
    }
    if (gate.user?.role !== "admin") {
        return NextResponse.json({ ok: false, message: "Only an administrator can move a board." }, { status: 403 });
    }
    const { board } = gate;

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

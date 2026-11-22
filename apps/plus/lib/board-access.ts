import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUserFromRequest, type SessionUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_boards } from "@/lib/db/schema";
import { canEditBoard, canReadBoard } from "@/lib/board-permissions";

export const validBoardId = (boardId: number) => Number.isSafeInteger(boardId) && boardId > 0;

export function boardReadFilter(user: SessionUser | null) {
    const publiclyVisible = eq(db_boards.privateFlg, 0);
    if (!user) {
        return publiclyVisible;
    }
    return user.role === "admin" ? undefined : or(publiclyVisible, eq(db_boards.ownerId, user.email));
}

export async function findBoard(boardId: number) {
    const [board] = await getDb().select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);
    return board;
}

const failure = (status: number, message: string) => ({
    failure: NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }),
});

export async function boardAccess(request: Request, boardId: number, action: "read" | "edit" = "read") {
    if (!validBoardId(boardId)) {
        return failure(400, "Invalid board id.");
    }
    const user = await getCurrentUserFromRequest(request);
    if (action === "edit" && !user) {
        return failure(401, "Please sign in first.");
    }
    const board = await findBoard(boardId);
    if (!board || !canReadBoard(user, board)) {
        return failure(404, "This board does not exist.");
    }
    if (action === "edit" && !canEditBoard(user, board)) {
        return failure(403, "You cannot edit this board.");
    }
    return { failure: null, board, user };
}

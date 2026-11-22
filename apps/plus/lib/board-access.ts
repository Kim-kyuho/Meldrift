import { and, eq, exists, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUserFromRequest, type SessionUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_boardMembers, db_boards } from "@/lib/db/schema";
import { canEditBoard, canManageBoard, canReadBoard, type BoardMemberRole } from "@/lib/board-permissions";

export const validBoardId = (boardId: number) => Number.isSafeInteger(boardId) && boardId > 0;

export function boardReadFilter(user: SessionUser | null) {
    const publiclyVisible = eq(db_boards.privateFlg, 0);
    if (!user) {
        return publiclyVisible;
    }
    if (user.role === "admin") {
        return undefined;
    }
    const sharedWithUser = exists(getDb().select({ boardId: db_boardMembers.boardId }).from(db_boardMembers).where(and(
        eq(db_boardMembers.boardId, db_boards.boardId),
        eq(db_boardMembers.userId, user.id),
    )));
    return or(publiclyVisible, eq(db_boards.ownerId, user.email), sharedWithUser);
}

export async function findBoard(boardId: number) {
    const [board] = await getDb().select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);
    return board;
}

export async function findMemberRole(boardId: number, userId: number | undefined): Promise<BoardMemberRole | null> {
    if (userId === undefined) {
        return null;
    }
    const [member] = await getDb().select({ role: db_boardMembers.role }).from(db_boardMembers)
        .where(and(eq(db_boardMembers.boardId, boardId), eq(db_boardMembers.userId, userId)))
        .limit(1);
    return member?.role ?? null;
}

// 소유자·관리자는 멤버 조회가 필요 없다. 그 밖의 로그인 사용자만 한 번 더 읽는다.
export async function memberRoleFor(user: SessionUser | null, board: { boardId: number; ownerId: string }) {
    if (!user || user.role === "admin" || user.email === board.ownerId) {
        return null;
    }
    return findMemberRole(board.boardId, user.id);
}

const failure = (status: number, message: string) => ({
    failure: NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }),
});

export type BoardAction = "read" | "edit" | "manage";

export async function boardAccessFor(user: SessionUser | null, boardId: number, action: BoardAction = "read") {
    if (!validBoardId(boardId)) {
        return failure(400, "Invalid board id.");
    }
    if (action !== "read" && !user) {
        return failure(401, "Please sign in first.");
    }
    const board = await findBoard(boardId);
    if (!board) {
        return failure(404, "This board does not exist.");
    }
    const memberRole = await memberRoleFor(user, board);
    if (!canReadBoard(user, board, memberRole)) {
        return failure(404, "This board does not exist.");
    }
    if (action === "edit" && !canEditBoard(user, board, memberRole)) {
        return failure(403, "You cannot edit this board.");
    }
    if (action === "manage" && !canManageBoard(user, board)) {
        return failure(403, "Only the board owner can manage this board.");
    }
    return { failure: null, board, user, memberRole };
}

export async function boardAccess(request: Request, boardId: number, action: BoardAction = "read") {
    if (!validBoardId(boardId)) {
        return failure(400, "Invalid board id.");
    }
    const user = await getCurrentUserFromRequest(request);
    return boardAccessFor(user, boardId, action);
}

import BoardList from "@/components/BoardList";
import { getCurrentUser } from "@/lib/auth/current-user";
import { boardReadFilter } from "@/lib/board-access";
import { canEditBoard } from "@/lib/board-permissions";
import { getDb } from "@/lib/db";
import { db_boards, db_boardPreviews } from "@/lib/db/schema";
import { asc, eq, sql } from "drizzle-orm";

export default async function Home() {
    const user = await getCurrentUser();
    const basePath = process.env.PLUS_STANDALONE === "true" ? "" : "/plus";
    const boards = await getDb()
        .select({
            boardId: db_boards.boardId,
            title: db_boards.title,
            width: db_boards.width,
            height: db_boards.height,
            createdAt: db_boards.createdAt,
            privateFlg: db_boards.privateFlg,
            ownerId: db_boards.ownerId,
            previewVersion: db_boards.previewVersion,
            hasPreview: db_boardPreviews.boardId,
        })
        .from(db_boards)
        .leftJoin(db_boardPreviews, eq(db_boardPreviews.boardId, db_boards.boardId))
        .where(boardReadFilter(user))
        .orderBy(sql`${db_boards.createdAt} DESC NULLS LAST`, asc(db_boards.boardId));

    const visibleBoards = boards.map((board) => ({
        boardId: board.boardId,
        title: board.title,
        width: board.width,
        height: board.height,
        createdAt: board.createdAt?.toISOString() ?? null,
        privateFlg: board.privateFlg,
        ownerEmail: user?.role === "admin" ? board.ownerId : null,
        canEdit: canEditBoard(user, board),
        previewUrl: board.hasPreview !== null || (board.privateFlg === 0 && Boolean(board.previewVersion))
            ? `${basePath}/api/boards/${board.boardId}/preview` : null,
    }));
    const initialUser = user ? { email: user.email, isApproved: user.isApproved, role: user.role } : null;

    return <BoardList key={user ? `${user.id}:${user.role}:${user.isApproved}` : "guest"} boards={visibleBoards} initialUser={initialUser} />;
}

import BoardSync from "@/components/BoardSync";
import { getCurrentUser } from "@/lib/auth/current-user";
import { findBoard, memberRoleFor, validBoardId } from "@/lib/board-access";
import { canEditBoard, canReadBoard } from "@/lib/board-permissions";
import { notFound } from "next/navigation";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
    const boardId = Number((await params).boardId);
    if (!validBoardId(boardId)) {
        notFound();
    }

    const [user, board] = await Promise.all([getCurrentUser(), findBoard(boardId)]);
    if (!board) {
        notFound();
    }
    const memberRole = await memberRoleFor(user, board);
    if (!canReadBoard(user, board, memberRole)) {
        notFound();
    }

    return <BoardSync
        key={boardId}
        editingAllowed={canEditBoard(user, board, memberRole)}
        collaborative={board.collabFlg === 1}
        board={{ boardId, title: board.title, width: board.width, height: board.height }}
    />;
}

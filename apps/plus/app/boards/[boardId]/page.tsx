import BoardSnapshotClient from "@/components/BoardSnapshotClient";
import { getCurrentUser } from "@/lib/auth/current-user";
import { findBoard, validBoardId } from "@/lib/board-access";
import { canEditBoard, canReadBoard } from "@/lib/board-permissions";
import { notFound } from "next/navigation";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
    const boardId = Number((await params).boardId);
    if (!validBoardId(boardId)) {
        notFound();
    }

    const [user, board] = await Promise.all([getCurrentUser(), findBoard(boardId)]);
    if (!board || !canReadBoard(user, board)) {
        notFound();
    }

    return <BoardSnapshotClient
        key={boardId}
        editingAllowed={canEditBoard(user, board)}
        board={{ boardId, title: board.title, width: board.width, height: board.height }}
    />;
}

import BoardSnapshotClient from "@/components/BoardSnapshotClient";
import { getDb } from "@/lib/db";
import { db_boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
    const boardId = Number((await params).boardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0) notFound();
    const [board] = await getDb().select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);
    if (!board) notFound();
    return <BoardSnapshotClient key={boardId} board={{
        boardId: board.boardId, title: board.title, width: board.width, height: board.height,
    }} />;
}

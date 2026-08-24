// app/boards/[boardId]/page.tsx

import BoardClient from "@/components/BoardClient";
import { getDb } from "@/lib/db";
import { db_boards, db_drawings, db_images, db_memos, db_mermaids, db_tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function BoardPage({
    params,
}: {
    params: Promise<{ boardId: string }>;
}) {
    const { boardId } = await params;
    const boardIdNumber = Number(boardId);

    if (!Number.isInteger(boardIdNumber) || boardIdNumber <= 0) {
        notFound();
    }

    const db = getDb();
    const currentBoard = await db
        .select()
        .from(db_boards)
        .where(eq(db_boards.boardId, boardIdNumber))
        .limit(1);

    if (!currentBoard[0]) {
        notFound();
    }
        
    const allMemos = await db
        .select()
        .from(db_memos)
        .where(eq(db_memos.boardId, boardIdNumber));

    const allImages = await db
        .select()
        .from(db_images)
        .where(eq(db_images.boardId, boardIdNumber));

    const allMermaids = await db
        .select()
        .from(db_mermaids)
        .where(eq(db_mermaids.boardId, boardIdNumber));

    const allTables = await db
        .select()
        .from(db_tables)
        .where(eq(db_tables.boardId, boardIdNumber));

    const boardDrawings = await db
        .select({ source: db_drawings.source })
        .from(db_drawings)
        .where(eq(db_drawings.boardId, boardIdNumber))
        .limit(1);

    const mappedMemos = allMemos.map((memo) => ({
        id: memo.id,
        boardId: memo.boardId,
        content: memo.content,
        x: memo.x,
        y: memo.y,
        z: memo.z,
        width: memo.width,
        height: memo.height,
        color: memo.color,
    }));

    const mappedImages = allImages.map((image) => ({
        imageId: image.imageId,
        boardId: image.boardId,
        publicId: image.publicId,
        secureUrl: image.secureUrl,
        fileName: image.fileName,
        x: image.x,
        y: image.y,
        z: image.z,
        width: image.width,
        height: image.height,
    }));

    const mappedMermaids = allMermaids.map((mermaid) => ({
        id: mermaid.mermaidId,
        boardId: mermaid.boardId,
        source: mermaid.source,
        x: mermaid.x,
        y: mermaid.y,
        z: mermaid.z,
        width: mermaid.width,
        height: mermaid.height,
    }));

    const mappedTables = allTables.map((table) => ({
        id: table.tableId,
        boardId: table.boardId,
        source: table.source,
        x: table.x,
        y: table.y,
        z: table.z,
        width: table.width,
        height: table.height,
    }));

    return (
        <BoardClient
            currentBoard={currentBoard[0]}
            mappedImages={mappedImages}
            mappedMemos={mappedMemos}
            mappedMermaids={mappedMermaids}
            mappedTables={mappedTables}
            mappedStrokes={boardDrawings[0]?.source ?? []}
        />
    );
}

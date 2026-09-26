import BoardList from "@/components/BoardList";
import { boardPreviewUrl } from "@/lib/board-preview";
import { getDb } from "@/lib/db";
import { db_boards } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  const db = getDb();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const boards = await db
      .select({
          boardId: db_boards.boardId,
          title: db_boards.title,
          width: db_boards.width,
          height: db_boards.height,
          previewVersion: db_boards.previewVersion,
      })
      .from(db_boards)
      .orderBy(asc(db_boards.boardId));

  const boardsWithPreview = boards.map(({ previewVersion, ...board }) => ({
      ...board,
      previewUrl: cloudName ? boardPreviewUrl(cloudName, board.boardId, previewVersion) : null,
  }));

  return <BoardList boards={boardsWithPreview} />;
}

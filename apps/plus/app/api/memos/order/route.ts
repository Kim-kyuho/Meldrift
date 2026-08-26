import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { db_memos } from "@/lib/db/schema";
import { reorderMemos } from "@/lib/memo-order";
import { asc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        const permissionMessage = getCardPermissionMessage(currentUser);

        if (permissionMessage) {
            return NextResponse.json(
                {
                    ok: false,
                    message: permissionMessage,
                },
                { status: 403 },
            );
        }

        const body = await request.json();
        const boardId = Number(body.boardId);
        const memoId = Number(body.memoId);
        const targetIndex = Number(body.targetIndex);

        if (
            !Number.isInteger(boardId) ||
            boardId <= 0 ||
            !Number.isInteger(memoId) ||
            memoId <= 0 ||
            !Number.isInteger(targetIndex) ||
            targetIndex < 0
        ) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid memo order request.",
                },
                { status: 400 },
            );
        }

        const db = getDb();
        // 순서는 서버가 가진 값이 기준이다. 클라이언트가 보낸 순서 값은 믿지 않는다.
        const memos = await db
            .select({ id: db_memos.id, sortOrder: db_memos.sortOrder })
            .from(db_memos)
            .where(eq(db_memos.boardId, boardId))
            .orderBy(asc(db_memos.sortOrder), asc(db_memos.id));

        if (!memos.some((memo) => memo.id === memoId)) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Memo does not exist on this board.",
                },
                { status: 404 },
            );
        }

        if (targetIndex >= memos.length) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Invalid memo order request.",
                },
                { status: 400 },
            );
        }

        const reordered = reorderMemos(memos, memoId, targetIndex);
        const changed = reordered.filter((memo, index) => memo.sortOrder !== memos[index].sortOrder);

        if (changed.length > 0) {
            const values = sql.join(
                changed.map((memo) => sql`(${memo.id}::integer, ${memo.sortOrder}::integer)`),
                sql`, `,
            );

            await db.execute(sql`
                UPDATE ${db_memos} AS m
                SET sort_order = reordered.sort_order
                FROM (VALUES ${values}) AS reordered(id, sort_order)
                WHERE m.id = reordered.id AND m.board_id = ${boardId}
            `);
        }

        return NextResponse.json({
            ok: true,
            memos: reordered,
        });
    } catch (error) {
        console.error("Error reordering memos:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while reordering memos.",
            },
            { status: 500 },
        );
    }
}

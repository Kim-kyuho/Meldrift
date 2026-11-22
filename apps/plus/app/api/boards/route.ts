import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { canCreateBoard } from "@/lib/board-permissions";
import { getDb } from "@/lib/db";
import { activeMember, membershipLock, requestSessionHash } from "@/lib/membership-guard";
import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createBoard = z.object({
    title: z.string().trim().min(1).max(200),
    width: z.number().int().positive().max(2147483647),
    height: z.number().int().positive().max(2147483647),
    privateFlg: z.union([z.literal(0), z.literal(1)]).default(1),
    collabFlg: z.union([z.literal(0), z.literal(1)]).default(0),
});

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ ok: false, message: "Please sign in first." }, { status: 401 });
        }
        if (!canCreateBoard(user)) {
            return NextResponse.json({ ok: false, message: "You cannot create boards." }, { status: 403 });
        }

        const parsed = createBoard.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ ok: false, message: "Invalid board title, size, visibility, or collaboration." }, { status: 400 });
        }
        const { title, width, height, privateFlg, collabFlg } = parsed.data;
        const db = getDb();
        const [, result] = await db.batch([db.execute(membershipLock), db.execute(sql`
            WITH created AS (
                INSERT INTO boards (title, width, height, owner_id, private_flg, collab_flg)
                SELECT ${title}, ${width}, ${height}, email, ${privateFlg}, ${collabFlg} FROM users
                WHERE ${activeMember(user.id, requestSessionHash(request))}
                    AND (permission_flg OR role = 'admin')
                RETURNING board_id
            ), synced AS (
                INSERT INTO board_sync (board_id, revision, mode)
                SELECT board_id, 0, 'delta' FROM created
            )
            SELECT board_id AS "boardId" FROM created
        `)]);
        const board = result.rows[0];
        if (!board) {
            return NextResponse.json({ ok: false, message: "Your permissions changed." }, { status: 403 });
        }
        return NextResponse.json({ ok: true, board });
    } catch (error) {
        console.error("Error creating board:", error);
        return NextResponse.json({ ok: false, message: "The board could not be created." }, { status: 500 });
    }
}

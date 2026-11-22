import { and, inArray, sql, type SQL } from "drizzle-orm";
import { prepareBoardPrivacy } from "@/lib/board-privacy";
import { getDb } from "@/lib/db";
import { db_boards, db_users } from "@/lib/db/schema";
import { membershipLock } from "@/lib/membership-guard";

export async function deleteMemberAccounts(ids: number[], authorized: SQL) {
    const db = getDb();
    const requested = await db.select({ email: db_users.email }).from(db_users)
        .where(and(inArray(db_users.id, ids), authorized));
    if (requested.length !== ids.length) {
        return null;
    }

    const boards = await db.select({ boardId: db_boards.boardId, previewVersion: db_boards.previewVersion })
        .from(db_boards).where(inArray(db_boards.ownerId, requested.map(({ email }) => email)));
    for (let offset = 0; offset < boards.length; offset += 4) {
        await Promise.all(boards.slice(offset, offset + 4).map(({ boardId, previewVersion }) =>
            prepareBoardPrivacy(boardId, previewVersion !== null)));
    }

    const idParams = sql.join(ids.map((id) => sql`${id}`), sql`, `);
    const [, result] = await db.batch([db.execute(membershipLock), db.execute(sql`
        WITH targets AS (
            SELECT id, email FROM users WHERE id IN (${idParams})
        ), allowed AS (
            SELECT 1 WHERE ${authorized} AND (SELECT count(*) FROM targets) = ${ids.length}
        ), retained AS (
            UPDATE boards SET private_flg = 1, preview_version = NULL, updated_at = now()
            WHERE owner_id IN (SELECT email FROM targets) AND EXISTS (SELECT 1 FROM allowed)
            RETURNING board_id
        ), deleted AS (
            DELETE FROM users WHERE id IN (SELECT id FROM targets) AND EXISTS (SELECT 1 FROM allowed)
            RETURNING id
        )
        SELECT (SELECT count(*) FROM deleted)::int AS deleted, (SELECT count(*) FROM retained)::int AS retained
    `)]);
    const row = result.rows[0];
    return row?.deleted === ids.length ? Number(row.retained) : null;
}

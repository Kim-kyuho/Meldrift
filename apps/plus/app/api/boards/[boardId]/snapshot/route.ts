import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { db_boards, db_boardSnapshots, db_boardSync } from "@/lib/db/schema";
import { getCurrentUserFromRequest, getCardPermissionMessage } from "@/lib/auth/current-user";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { loadBoardState } from "@/lib/board-state-store";
import { decodeSnapshot } from "@/lib/snapshot-codec";
import { maxSnapshotBytes, snapshotFormatVersion } from "@/lib/snapshot";

type Context = { params: Promise<{ boardId: string }> };
export const maxDuration = 60;

export async function GET(_request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0) return new NextResponse(null, { status: 404 });
    const db = getDb();
    const [board] = await db.select().from(db_boards).where(eq(db_boards.boardId, boardId)).limit(1);
    if (!board) return new NextResponse(null, { status: 404 });
    const [sync] = await db.select().from(db_boardSync).where(eq(db_boardSync.boardId, boardId)).limit(1);
    const mode = sync?.mode ?? "snapshot";
    if (mode !== "snapshot") {
        return NextResponse.json({ mode, revision: sync?.revision ?? 0 }, {
            headers: { "Cache-Control": "no-store", "X-Storage-Mode": mode },
        });
    }
    const [saved] = await db.select().from(db_boardSnapshots).where(eq(db_boardSnapshots.boardId, boardId)).limit(1);
    if (!saved) {
        return NextResponse.json({ legacy: await loadBoardState(board), revision: 0 }, {
            headers: { "Cache-Control": "no-store", "X-Storage-Mode": mode },
        });
    }
    return new NextResponse(new Uint8Array(saved.snapshot), {
        headers: {
            "Content-Type": "application/vnd.sqlite3",
            "Cache-Control": "no-store",
            "X-Snapshot-Revision": String(saved.revision),
            "X-Snapshot-Mutation": saved.mutationId,
            "X-Storage-Mode": mode,
        },
    });
}

export async function PUT(request: NextRequest, { params }: Context) {
    const user = await getCurrentUserFromRequest(request);
    const message = getCardPermissionMessage(user);
    if (message || !user) return NextResponse.json({ message }, { status: 403 });
    const boardId = Number((await params).boardId);
    const revisionHeader = request.headers.get("X-Snapshot-Revision");
    const revision = Number(revisionHeader);
    const mutationId = request.headers.get("X-Snapshot-Mutation") ?? "";
    const tabId = request.headers.get("X-Editor-Tab") ?? "";
    if (!Number.isSafeInteger(boardId) || boardId <= 0 || revisionHeader === null || !Number.isSafeInteger(revision) || revision < 0
        || !/^[a-zA-Z0-9:-]{1,160}$/.test(mutationId) || !/^[a-zA-Z0-9-]{20,80}$/.test(tabId)) {
        return NextResponse.json({ message: "Invalid snapshot request." }, { status: 400 });
    }
    if (Number(request.headers.get("Content-Length")) > maxSnapshotBytes) {
        return NextResponse.json({ message: "Board snapshots must be 4 MiB or smaller." }, { status: 413 });
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > maxSnapshotBytes) {
        return NextResponse.json({ message: "Board snapshots must be 4 MiB or smaller." }, { status: 413 });
    }
    try { await decodeSnapshot(bytes, boardId); }
    catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Invalid snapshot." }, { status: 400 });
    }
    const hash = getSessionTokenHash(request.cookies.get(sessionCookieName)?.value);
    // The lease, session and expected revision are checked by the write itself.
    const result = await getDb().execute(sql`
        INSERT INTO board_snapshots (board_id, snapshot, format_version, revision, mutation_id)
        SELECT b.board_id, decode(${Buffer.from(bytes).toString("hex")}, 'hex'), ${snapshotFormatVersion},
            ${revision + 1}, ${mutationId}
        FROM (SELECT board_id FROM boards WHERE board_id = ${boardId} FOR UPDATE) b,
            users u JOIN editor_leases e ON e.user_id = u.id
        WHERE b.board_id = ${boardId} AND u.id = ${user.id} AND u.permission_flg = true
            AND u.session_token_hash = ${hash} AND u.session_expires_at > now()
            AND e.session_hash = u.session_token_hash AND e.tab_id = ${tabId} AND e.expires_at > now()
            AND (${revision} = 0 OR EXISTS (SELECT 1 FROM board_snapshots WHERE board_id = ${boardId}))
            AND NOT EXISTS (SELECT 1 FROM board_sync WHERE board_id = ${boardId} AND mode <> 'snapshot')
        ON CONFLICT (board_id) DO UPDATE SET
            snapshot = excluded.snapshot, format_version = excluded.format_version,
            revision = board_snapshots.revision + CASE WHEN board_snapshots.mutation_id = excluded.mutation_id THEN 0 ELSE 1 END,
            mutation_id = excluded.mutation_id, updated_at = now()
        WHERE board_snapshots.revision = ${revision} OR board_snapshots.mutation_id = excluded.mutation_id
        RETURNING revision
    `);
    if (!result.rows.length) {
        return NextResponse.json({ message: "The session, editor lease, board version or storage mode changed. Reload to recover." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, revision: Number(result.rows[0].revision) });
}

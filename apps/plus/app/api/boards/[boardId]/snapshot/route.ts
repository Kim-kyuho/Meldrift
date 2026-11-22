import { boardAccess } from "@/lib/board-access";
import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { db_boardSnapshots, db_boardSync } from "@/lib/db/schema";
import { editorFromRequest, editorSessionGuard } from "@/lib/editor-guard";
import { loadBoardState } from "@/lib/board-state-store";
import { decodeSnapshot } from "@/lib/snapshot-codec";
import { maxSnapshotBytes, snapshotFormatVersion } from "@/lib/snapshot";

type Context = { params: Promise<{ boardId: string }> };
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: Context) {
    const boardId = Number((await params).boardId);
    if (!Number.isSafeInteger(boardId) || boardId <= 0) {
        return new NextResponse(null, { status: 404 });
    }
    const db = getDb();
    const gate = await boardAccess(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    const { board } = gate;

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
    const boardId = Number((await params).boardId);
    const gate = await editorFromRequest(request, boardId);
    if (gate.failure) {
        return gate.failure;
    }
    const revisionHeader = request.headers.get("X-Snapshot-Revision");
    const revision = Number(revisionHeader);
    const mutationId = request.headers.get("X-Snapshot-Mutation") ?? "";
    const validBoardId = Number.isSafeInteger(boardId) && boardId > 0;
    const validRevision = revisionHeader !== null && Number.isSafeInteger(revision) && revision >= 0;
    const validMutationId = /^[a-zA-Z0-9:-]{1,160}$/.test(mutationId);
    if (!validBoardId || !validRevision || !validMutationId) {
        return NextResponse.json({ message: "Invalid snapshot request." }, { status: 400 });
    }
    if (Number(request.headers.get("Content-Length")) > maxSnapshotBytes) {
        return NextResponse.json({ message: "Board snapshots must be 4 MiB or smaller." }, { status: 413 });
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > maxSnapshotBytes) {
        return NextResponse.json({ message: "Board snapshots must be 4 MiB or smaller." }, { status: 413 });
    }
    try {
        await decodeSnapshot(bytes, boardId);
    } catch (error) {
        return NextResponse.json({ message: error instanceof Error ? error.message : "Invalid snapshot." }, { status: 400 });
    }
    // The lease, session and expected revision are checked by the write itself.
    const result = await getDb().execute(sql`
        INSERT INTO board_snapshots (board_id, snapshot, format_version, revision, mutation_id)
        SELECT b.board_id, decode(${Buffer.from(bytes).toString("hex")}, 'hex'), ${snapshotFormatVersion},
            ${revision + 1}, ${mutationId}
        FROM (SELECT board_id FROM boards WHERE board_id = ${boardId} FOR UPDATE) b
        WHERE ${editorSessionGuard(gate.identity, boardId)}
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
        return NextResponse.json({ message: "The session, board version or storage mode changed. Reload to recover." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, revision: Number(result.rows[0].revision) });
}

import { and, asc, eq, gt } from "drizzle-orm";
import type { BoardOperation } from "@meldrift/board-data/board-delta";
import { getDb } from "@/lib/db";
import { db_boardSync, db_syncMutations, db_users } from "@/lib/db/schema";
import { liveLimits, maskEmail, type CommitAuthor, type LiveCommit } from "./protocol";
import type { LiveStore } from "./store/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 커밋은 Redis를 기다리지 않는다. 이 시간 안에 답이 없으면 잠금 검사·알림 없이 진행한다.
export const liveStoreTimeoutMs = 2000;

export class LiveStoreTimeout extends Error {}

export function withTimeout<T>(promise: Promise<T>, ms = liveStoreTimeoutMs): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new LiveStoreTimeout(`The live store did not answer within ${ms}ms.`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function liveClientIdFrom(request: Request) {
    const value = request.headers.get("X-Meldrift-Client");
    return value && uuidPattern.test(value) ? value.toLowerCase() : null;
}

// Redis가 응답하지 않으면 커밋을 막지 않는다. 겹침 검사가 일관성을 지킨다.
export async function foreignLockFor(store: LiveStore | null, boardId: number, holder: string, keys: string[]) {
    if (!store || keys.length === 0) {
        return null;
    }
    try {
        return await withTimeout(store.foreignLock(boardId, holder, keys));
    } catch (error) {
        console.error("live.lock_check_failed", error);
        return null;
    }
}

export async function announceCommit(
    store: LiveStore | null, boardId: number, touched: string[], commit: LiveCommit,
) {
    if (!store) {
        return;
    }
    try {
        const inline = commit.operations
            && Buffer.byteLength(JSON.stringify(commit.operations)) <= liveLimits.inlineCommitBytes;
        await withTimeout(Promise.all([
            store.recordTouched(boardId, touched, commit.revision),
            store.publish(boardId, { t: "commit", ...commit, operations: inline ? commit.operations : null }),
        ]));
    } catch (error) {
        console.error("live.commit_announce_failed", error);
    }
}

export type ChangeLogEntry = { revision: number; mutationId: string; by: CommitAuthor; operations: BoardOperation[] };

export type ChangeLogResult =
    | { status: "ok"; head: number; mutations: ChangeLogEntry[]; more: boolean }
    | { status: "gone"; head: number };

// 재연결·빈 판 채우기에 쓴다. 요청한 판 바로 다음부터 끊김 없이 이어져야 한다. 아니면 전체 재동기화를 요구한다.
export async function readChangeLog(boardId: number, after: number, limit: number, seesEmails: boolean): Promise<ChangeLogResult> {
    const db = getDb();
    const [sync] = await db.select({ revision: db_boardSync.revision }).from(db_boardSync)
        .where(eq(db_boardSync.boardId, boardId)).limit(1);
    const head = sync?.revision ?? 0;
    if (after >= head) {
        return { status: "ok", head, mutations: [], more: false };
    }
    const rows = await db.select({
        revision: db_syncMutations.revision,
        mutationId: db_syncMutations.mutationId,
        operations: db_syncMutations.operations,
        authorId: db_syncMutations.authorId,
        authorClient: db_syncMutations.authorClient,
        email: db_users.email,
    }).from(db_syncMutations)
        .leftJoin(db_users, eq(db_users.id, db_syncMutations.authorId))
        .where(and(eq(db_syncMutations.boardId, boardId), gt(db_syncMutations.revision, after)))
        .orderBy(asc(db_syncMutations.revision))
        .limit(limit);

    const contiguous = rows.every((row, index) => row.revision === after + 1 + index && row.operations !== null);
    if (rows.length === 0 || !contiguous) {
        return { status: "gone", head };
    }
    return {
        status: "ok",
        head,
        more: rows[rows.length - 1].revision < head,
        mutations: rows.map((row) => ({
            revision: row.revision,
            mutationId: row.mutationId,
            operations: row.operations ?? [],
            by: {
                userId: row.authorId ?? 0,
                email: seesEmails ? row.email : maskEmail(row.email),
                clientId: row.authorClient,
            },
        })),
    };
}

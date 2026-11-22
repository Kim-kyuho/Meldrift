import type { BoardEvent, LiveLock } from "../protocol";
import { findConflict } from "./lock-rules";
import type { AcquireResult, BoardEventListener, LiveStore, PresenceRecord, StoredLock } from "./types";

type PresenceEntry = PresenceRecord & { lastSeen: number };

const toRecord = (entry: PresenceEntry): PresenceRecord => ({
    clientId: entry.clientId,
    userId: entry.userId,
    email: entry.email,
    role: entry.role,
    color: entry.color,
    joinedAt: entry.joinedAt,
    connId: entry.connId,
});

type BoardState = {
    locks: Map<string, StoredLock>;
    presence: Map<string, PresenceEntry>;
    touched: Map<string, number>;
    listeners: Set<BoardEventListener>;
};

// 프로세스 하나 안에서만 공유된다. 로컬 개발 서버와 단위 테스트용이다.
export class MemoryLiveStore implements LiveStore {
    private boards = new Map<number, BoardState>();

    constructor(private now: () => number = Date.now) {}

    private board(boardId: number) {
        let state = this.boards.get(boardId);
        if (!state) {
            state = { locks: new Map(), presence: new Map(), touched: new Map(), listeners: new Set() };
            this.boards.set(boardId, state);
        }
        return state;
    }

    async publish(boardId: number, event: BoardEvent) {
        const copy = JSON.parse(JSON.stringify(event)) as BoardEvent;
        for (const listener of [...this.board(boardId).listeners]) {
            queueMicrotask(() => listener(copy));
        }
    }

    async subscribe(boardId: number, listener: BoardEventListener) {
        this.board(boardId).listeners.add(listener);
        return async () => {
            this.board(boardId).listeners.delete(listener);
        };
    }

    async acquire(boardId: number, lock: LiveLock, keys: string[], ttlMs: number): Promise<AcquireResult> {
        const state = this.board(boardId);
        const now = this.now();
        const conflict = findConflict(state.locks.values(), lock.holder, keys, now);
        if (conflict) {
            return { granted: false, conflict };
        }
        for (const key of keys) {
            state.locks.set(key, { ...lock, key, expiresAt: now + ttlMs });
        }
        return { granted: true };
    }

    async release(boardId: number, holder: string, keys: string[]) {
        const state = this.board(boardId);
        const released: string[] = [];
        for (const key of keys) {
            if (state.locks.get(key)?.holder === holder) {
                state.locks.delete(key);
                released.push(key);
            }
        }
        return released;
    }

    async renew(boardId: number, holders: string[], ttlMs: number) {
        const state = this.board(boardId);
        const expiresAt = this.now() + ttlMs;
        for (const entry of state.locks.values()) {
            if (holders.includes(entry.holder)) {
                entry.expiresAt = expiresAt;
            }
        }
    }

    async reassert(boardId: number, lock: LiveLock, keys: string[], ttlMs: number) {
        const state = this.board(boardId);
        const now = this.now();
        const held: string[] = [];
        const lost: string[] = [];
        for (const key of keys) {
            if (findConflict(state.locks.values(), lock.holder, [key], now)) {
                lost.push(key);
                continue;
            }
            state.locks.set(key, { ...lock, key, expiresAt: now + ttlMs });
            held.push(key);
        }
        return { held, lost };
    }

    async purgeHolder(boardId: number, holder: string) {
        const state = this.board(boardId);
        const purged: string[] = [];
        for (const [key, entry] of state.locks) {
            if (entry.holder === holder) {
                state.locks.delete(key);
                purged.push(key);
            }
        }
        return purged;
    }

    async locks(boardId: number) {
        const now = this.now();
        return [...this.board(boardId).locks.values()].filter((entry) => entry.expiresAt > now);
    }

    async foreignLock(boardId: number, holder: string | null, keys: string[]) {
        return findConflict(this.board(boardId).locks.values(), holder ?? "", keys, this.now());
    }

    async join(boardId: number, record: PresenceRecord) {
        const state = this.board(boardId);
        const isNew = !state.presence.has(record.clientId);
        state.presence.set(record.clientId, { ...record, lastSeen: this.now() });
        return isNew;
    }

    async touch(boardId: number, clientIds: string[]) {
        const state = this.board(boardId);
        const now = this.now();
        for (const clientId of clientIds) {
            const entry = state.presence.get(clientId);
            if (entry) {
                entry.lastSeen = now;
            }
        }
    }

    async leave(boardId: number, clientId: string, connId: string) {
        const state = this.board(boardId);
        if (state.presence.get(clientId)?.connId !== connId) {
            return false;
        }
        state.presence.delete(clientId);
        return true;
    }

    async peers(boardId: number) {
        return [...this.board(boardId).presence.values()].map(toRecord);
    }

    async sweep(boardId: number, staleMs: number) {
        const state = this.board(boardId);
        const cutoff = this.now() - staleMs;
        const removed: PresenceRecord[] = [];
        for (const [clientId, entry] of state.presence) {
            if (entry.lastSeen < cutoff) {
                state.presence.delete(clientId);
                removed.push(toRecord(entry));
            }
        }
        return removed;
    }

    async recordTouched(boardId: number, keys: string[], revision: number) {
        const state = this.board(boardId);
        for (const key of keys) {
            state.touched.set(key, Math.max(state.touched.get(key) ?? 0, revision));
        }
    }

    async keyRevision(boardId: number, keys: string[]) {
        const state = this.board(boardId);
        return keys.reduce((highest, key) => Math.max(highest, state.touched.get(key) ?? 0), 0);
    }

    async close() {
        this.boards.clear();
    }
}

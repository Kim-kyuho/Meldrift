import type { LiveLock } from "../protocol";
import { findConflict } from "./lock-rules";
import type { AcquireResult, LiveStore, StoredLock } from "./types";

type BoardState = {
    locks: Map<string, StoredLock>;
    touched: Map<string, number>;
};

// 프로세스 하나 안에서만 공유된다. 로컬 개발 서버와 단위 테스트용이다.
export class MemoryLiveStore implements LiveStore {
    private boards = new Map<number, BoardState>();
    private peerRooms = new Map<number, { data: string; expiresAt: number }>();

    constructor(private now: () => number = Date.now) {}

    private peerRoom(boardId: number) {
        const room = this.peerRooms.get(boardId);
        if (room && room.expiresAt <= this.now()) {
            this.peerRooms.delete(boardId);
            return null;
        }
        return room?.data ?? null;
    }

    async readPeerRoom(boardId: number) {
        return this.peerRoom(boardId);
    }

    async writePeerRoom(boardId: number, expected: string | null, data: string | null, ttlMs: number) {
        if (this.peerRoom(boardId) !== expected) {
            return false;
        }
        if (data === null) {
            this.peerRooms.delete(boardId);
        } else {
            this.peerRooms.set(boardId, { data, expiresAt: this.now() + ttlMs });
        }
        return true;
    }

    private board(boardId: number) {
        let state = this.boards.get(boardId);
        if (!state) {
            state = { locks: new Map(), touched: new Map() };
            this.boards.set(boardId, state);
        }
        return state;
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
        const now = this.now();
        for (const entry of state.locks.values()) {
            if (entry.expiresAt > now && holders.includes(entry.holder)) {
                entry.expiresAt = now + ttlMs;
            }
        }
    }

    async locks(boardId: number) {
        const now = this.now();
        return [...this.board(boardId).locks.values()].filter((entry) => entry.expiresAt > now);
    }

    async foreignLock(boardId: number, holder: string | null, keys: string[]) {
        return findConflict(this.board(boardId).locks.values(), holder ?? "", keys, this.now());
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
        this.peerRooms.clear();
    }
}

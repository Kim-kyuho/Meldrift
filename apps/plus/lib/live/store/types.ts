import type { LiveLock } from "../protocol";

export type StoredLock = LiveLock & { expiresAt: number };

export type AcquireResult = { granted: true } | { granted: false; conflict: StoredLock | null };

// Redis와 개발용 메모리 저장소가 같은 의미를 지켜야 한다. 시각은 저장소가 정한다.
export interface LiveStore {
    readPeerRoom(boardId: number): Promise<string | null>;
    writePeerRoom(boardId: number, expected: string | null, data: string | null, ttlMs: number): Promise<boolean>;

    acquire(boardId: number, lock: LiveLock, keys: string[], ttlMs: number): Promise<AcquireResult>;
    release(boardId: number, holder: string, keys: string[]): Promise<string[]>;
    renew(boardId: number, holders: string[], ttlMs: number): Promise<void>;
    locks(boardId: number): Promise<StoredLock[]>;
    foreignLock(boardId: number, holder: string | null, keys: string[]): Promise<StoredLock | null>;

    recordTouched(boardId: number, keys: string[], revision: number): Promise<void>;
    keyRevision(boardId: number, keys: string[]): Promise<number>;

    close(): Promise<void>;
}

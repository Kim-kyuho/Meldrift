import type { BoardEvent, LiveLock, LivePeer } from "../protocol";

export type StoredLock = LiveLock & { expiresAt: number };

export type PresenceRecord = LivePeer & { connId: string };

export type AcquireResult = { granted: true } | { granted: false; conflict: StoredLock | null };

export type BoardEventListener = (event: BoardEvent) => void;

// Redis와 개발용 메모리 저장소가 같은 의미를 지켜야 한다. 시각은 저장소가 정한다.
export interface LiveStore {
    publish(boardId: number, event: BoardEvent): Promise<void>;
    subscribe(boardId: number, listener: BoardEventListener): Promise<() => Promise<void>>;

    acquire(boardId: number, lock: LiveLock, keys: string[], ttlMs: number): Promise<AcquireResult>;
    release(boardId: number, holder: string, keys: string[]): Promise<string[]>;
    renew(boardId: number, holders: string[], ttlMs: number): Promise<void>;
    reassert(boardId: number, lock: LiveLock, keys: string[], ttlMs: number): Promise<{ held: string[]; lost: string[] }>;
    purgeHolder(boardId: number, holder: string): Promise<string[]>;
    locks(boardId: number): Promise<StoredLock[]>;
    foreignLock(boardId: number, holder: string | null, keys: string[]): Promise<StoredLock | null>;

    join(boardId: number, record: PresenceRecord): Promise<boolean>;
    touch(boardId: number, clientIds: string[]): Promise<void>;
    leave(boardId: number, clientId: string, connId: string): Promise<boolean>;
    peers(boardId: number): Promise<PresenceRecord[]>;
    sweep(boardId: number, staleMs: number): Promise<PresenceRecord[]>;

    recordTouched(boardId: number, keys: string[], revision: number): Promise<void>;
    keyRevision(boardId: number, keys: string[]): Promise<number>;

    close(): Promise<void>;
}

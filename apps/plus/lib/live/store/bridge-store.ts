import type { BoardEvent } from "../protocol";
import type { AcquireResult, LiveStore, PresenceRecord, StoredLock } from "./types";

// REDIS_URL 없이 로컬에서 개발할 때, Next 프로세스의 커밋 라우트가 개발용 Live 서버의 메모리 저장소를 쓰게 한다.
// 커밋 라우트가 쓰는 메서드만 전달한다.
export class BridgeLiveStore implements LiveStore {
    constructor(private url: string, private secret: string) {}

    private async call<T>(method: string, args: unknown[]): Promise<T> {
        const response = await fetch(this.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Live-Bridge-Secret": this.secret },
            body: JSON.stringify({ method, args }),
            signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) {
            throw new Error(`The live development bridge answered ${response.status}.`);
        }
        return (await response.json() as { value: T }).value;
    }

    publish(boardId: number, event: BoardEvent) {
        return this.call<void>("publish", [boardId, event]);
    }

    foreignLock(boardId: number, holder: string | null, keys: string[]) {
        return this.call<StoredLock | null>("foreignLock", [boardId, holder, keys]);
    }

    recordTouched(boardId: number, keys: string[], revision: number) {
        return this.call<void>("recordTouched", [boardId, keys, revision]);
    }

    keyRevision(boardId: number, keys: string[]) {
        return this.call<number>("keyRevision", [boardId, keys]);
    }

    private unsupported(): never {
        throw new Error("The live development bridge only serves the commit route.");
    }

    subscribe(): Promise<() => Promise<void>> {
        return this.unsupported();
    }

    acquire(): Promise<AcquireResult> {
        return this.unsupported();
    }

    release(): Promise<string[]> {
        return this.unsupported();
    }

    renew(): Promise<void> {
        return this.unsupported();
    }

    reassert(): Promise<{ held: string[]; lost: string[] }> {
        return this.unsupported();
    }

    purgeHolder(): Promise<string[]> {
        return this.unsupported();
    }

    locks(): Promise<StoredLock[]> {
        return this.unsupported();
    }

    join(): Promise<boolean> {
        return this.unsupported();
    }

    touch(): Promise<void> {
        return this.unsupported();
    }

    leave(): Promise<boolean> {
        return this.unsupported();
    }

    peers(): Promise<PresenceRecord[]> {
        return this.unsupported();
    }

    sweep(): Promise<PresenceRecord[]> {
        return this.unsupported();
    }

    async close() {}
}

export const bridgeMethods = ["publish", "foreignLock", "recordTouched", "keyRevision"] as const;

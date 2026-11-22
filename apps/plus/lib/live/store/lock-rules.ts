import { boardLockKey } from "@meldrift/board-data/board-delta";
import type { StoredLock } from "./types";

// Redis Lua 스크립트(redis-store.ts)가 같은 규칙을 그대로 옮겨 쓴다. 한쪽을 바꾸면 다른 쪽도 바꾼다.
export function findConflict(
    entries: Iterable<StoredLock>, holder: string, keys: string[], now: number,
): StoredLock | null {
    const live = [...entries].filter((entry) => entry.expiresAt > now && entry.holder !== holder);
    const byKey = new Map(live.map((entry) => [entry.key, entry]));
    const boardLock = byKey.get(boardLockKey);
    if (boardLock) {
        return boardLock;
    }
    for (const key of keys) {
        const conflict = byKey.get(key);
        if (conflict) {
            return conflict;
        }
    }
    if (keys.includes(boardLockKey) && live.length > 0) {
        return live[0];
    }
    return null;
}

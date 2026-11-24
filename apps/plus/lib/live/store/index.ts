import { MemoryLiveStore } from "./memory-store";
import { RedisLiveStore } from "./redis-store";
import type { LiveStore } from "./types";

type LiveGlobal = typeof globalThis & { __meldriftLiveStore?: LiveStore | null };

export const liveEnabled = () => process.env.LIVE_ENABLED === "true";

// Production replicas share Redis. A local Next process can run the entire room in memory.
function createStore(): LiveStore | null {
    if (process.env.REDIS_URL) {
        return new RedisLiveStore(process.env.REDIS_URL);
    }
    return process.env.NODE_ENV === "production" ? null : new MemoryLiveStore();
}

export function getLiveStore(): LiveStore | null {
    if (!liveEnabled()) {
        return null;
    }
    const scope = globalThis as LiveGlobal;
    if (scope.__meldriftLiveStore === undefined) {
        scope.__meldriftLiveStore = createStore();
    }
    return scope.__meldriftLiveStore;
}

export type { LiveStore } from "./types";

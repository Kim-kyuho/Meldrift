import { BridgeLiveStore } from "./bridge-store";
import { MemoryLiveStore } from "./memory-store";
import { RedisLiveStore } from "./redis-store";
import type { LiveStore } from "./types";

type LiveGlobal = typeof globalThis & { __meldriftLiveStore?: LiveStore | null };

export const liveEnabled = () => process.env.LIVE_ENABLED === "true";

// 운영: REDIS_URL. 로컬 Next 프로세스: 개발용 Live 서버로 가는 브리지. 개발용 Live 서버 자신: 메모리.
function createStore(): LiveStore | null {
    if (process.env.REDIS_URL) {
        return new RedisLiveStore(process.env.REDIS_URL);
    }
    if (process.env.LIVE_DEV_SERVER === "true") {
        return new MemoryLiveStore();
    }
    if (process.env.LIVE_DEV_BRIDGE_URL && process.env.NODE_ENV !== "production") {
        return new BridgeLiveStore(process.env.LIVE_DEV_BRIDGE_URL, liveBridgeSecret());
    }
    return null;
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

export function liveBridgeSecret() {
    return process.env.LIVE_TOKEN_SECRET ?? "meldrift-live-development-secret";
}

export type { LiveStore } from "./types";

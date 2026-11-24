type StoredValue = { data: string; expiresAt: number };

export interface RoomStore {
    read(key: string): Promise<string | null>;
    compareAndSet(key: string, expected: string | null, next: StoredValue | null): Promise<boolean>;
    increment(key: string, windowMs: number): Promise<number>;
}

export class MemoryRoomStore implements RoomStore {
    private entries = new Map<string, StoredValue>();

    private removeExpired() {
        const now = Date.now();
        for (const [key, value] of this.entries) {
            if (value.expiresAt <= now) {
                this.entries.delete(key);
            }
        }
    }

    async read(key: string) {
        return this.value(key)?.data ?? null;
    }

    async compareAndSet(key: string, expected: string | null, next: StoredValue | null) {
        this.removeExpired();
        if ((this.entries.get(key)?.data ?? null) !== expected) {
            return false;
        }
        if (next) {
            this.entries.set(key, next);
        } else {
            this.entries.delete(key);
        }
        return true;
    }

    async increment(key: string, windowMs: number) {
        this.removeExpired();
        const current = this.entries.get(key);
        const count = Number(current?.data ?? 0) + 1;
        this.entries.set(key, { data: String(count), expiresAt: current?.expiresAt ?? Date.now() + windowMs });
        return count;
    }

    private value(key: string) {
        const entry = this.entries.get(key);
        if (entry && entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry;
    }
}

const compareAndSetScript = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
if ARGV[2] == '' then
    redis.call('DEL', KEYS[1])
else
    redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
end
return 1`;

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count`;

class RedisRoomStore implements RoomStore {
    constructor(private readonly url: string, private readonly token: string) {}

    private async command<T>(...args: (string | number)[]): Promise<T> {
        const response = await fetch(this.url, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(3_000),
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("The room store did not respond.");
        }
        const body = await response.json() as { result?: T; error?: string };
        if (body.error || body.result === undefined) {
            throw new Error("The room store rejected the command.");
        }
        return body.result;
    }

    read(key: string) {
        return this.command<string | null>("GET", key);
    }

    async compareAndSet(key: string, expected: string | null, next: StoredValue | null) {
        const ttl = Math.max(1, (next?.expiresAt ?? Date.now()) - Date.now());
        const result = await this.command<number>("EVAL", compareAndSetScript, 1, key, expected ?? "", next?.data ?? "", ttl);
        return result === 1;
    }

    increment(key: string, windowMs: number) {
        return this.command<number>("EVAL", incrementScript, 1, key, windowMs);
    }
}

const scope = globalThis as typeof globalThis & { meldriftLocalPeerRooms?: MemoryRoomStore };

export function peerLiveConfigured() {
    return process.env.PEER_LIVE_ENABLED !== "false" && (process.env.NODE_ENV !== "production"
        || Boolean(process.env.PEER_LIVE_REDIS_REST_URL && process.env.PEER_LIVE_REDIS_REST_TOKEN));
}

export function getRoomStore(): RoomStore | null {
    if (!peerLiveConfigured()) {
        return null;
    }
    const { PEER_LIVE_REDIS_REST_URL: url, PEER_LIVE_REDIS_REST_TOKEN: token } = process.env;
    if (url && token) {
        return new RedisRoomStore(url, token);
    }
    return scope.meldriftLocalPeerRooms ??= new MemoryRoomStore();
}

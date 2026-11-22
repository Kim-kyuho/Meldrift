import { createClient } from "redis";
import type { BoardEvent, LiveLock } from "../protocol";
import type { AcquireResult, BoardEventListener, LiveStore, PresenceRecord, StoredLock } from "./types";

type RedisClient = ReturnType<typeof createClient>;

const dayMs = "86400000";
const locksKey = (boardId: number) => `mdr:locks:${boardId}`;
const presenceKey = (boardId: number) => `mdr:presence:${boardId}`;
const presenceInfoKey = (boardId: number) => `mdr:presence-info:${boardId}`;
const touchedKey = (boardId: number) => `mdr:touched:${boardId}`;
const channelOf = (boardId: number) => `mdr:board:${boardId}`;

// 모든 스크립트는 Redis 서버 시각을 쓴다. 인스턴스마다 시계가 달라도 만료 판정이 같다.
const clock = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
`;

// lock-rules.ts의 findConflict와 같은 규칙이다.
const liveOthers = `
local function liveOthers(hashKey, holder)
    local all = redis.call('HGETALL', hashKey)
    local live = {}
    local first = nil
    for i = 1, #all, 2 do
        local entry = cjson.decode(all[i + 1])
        if tonumber(entry.expiresAt) > now and entry.holder ~= holder then
            live[all[i]] = all[i + 1]
            if not first then
                first = all[i + 1]
            end
        end
    end
    return live, first
end
local function conflictFor(live, first, keys)
    if live['board:*'] then
        return live['board:*']
    end
    local wantsBoard = false
    for _, key in ipairs(keys) do
        if live[key] then
            return live[key]
        end
        if key == 'board:*' then
            wantsBoard = true
        end
    end
    if wantsBoard and first then
        return first
    end
    return nil
end
`;

const acquireScript = `${clock}${liveOthers}
local keys = {}
for i = 4, #ARGV do
    keys[#keys + 1] = ARGV[i]
end
local live, first = liveOthers(KEYS[1], ARGV[1])
local conflict = conflictFor(live, first, keys)
if conflict then
    return { 0, conflict }
end
local entry = cjson.decode(ARGV[3])
entry.expiresAt = now + tonumber(ARGV[2])
for _, key in ipairs(keys) do
    entry.key = key
    redis.call('HSET', KEYS[1], key, cjson.encode(entry))
end
redis.call('PEXPIRE', KEYS[1], ${dayMs})
return { 1 }
`;

const reassertScript = `${clock}${liveOthers}
local live, first = liveOthers(KEYS[1], ARGV[1])
local entry = cjson.decode(ARGV[3])
entry.expiresAt = now + tonumber(ARGV[2])
local held = {}
local lost = {}
for i = 4, #ARGV do
    local key = ARGV[i]
    if conflictFor(live, first, { key }) then
        lost[#lost + 1] = key
    else
        entry.key = key
        redis.call('HSET', KEYS[1], key, cjson.encode(entry))
        held[#held + 1] = key
    end
end
redis.call('PEXPIRE', KEYS[1], ${dayMs})
return { held, lost }
`;

const foreignScript = `${clock}${liveOthers}
local keys = {}
for i = 2, #ARGV do
    keys[#keys + 1] = ARGV[i]
end
local live, first = liveOthers(KEYS[1], ARGV[1])
return conflictFor(live, first, keys)
`;

const releaseScript = `
local released = {}
for i = 2, #ARGV do
    local raw = redis.call('HGET', KEYS[1], ARGV[i])
    if raw and cjson.decode(raw).holder == ARGV[1] then
        redis.call('HDEL', KEYS[1], ARGV[i])
        released[#released + 1] = ARGV[i]
    end
end
return released
`;

const renewScript = `${clock}
local holders = {}
for i = 2, #ARGV do
    holders[ARGV[i]] = true
end
local all = redis.call('HGETALL', KEYS[1])
for i = 1, #all, 2 do
    local entry = cjson.decode(all[i + 1])
    if holders[entry.holder] then
        entry.expiresAt = now + tonumber(ARGV[1])
        redis.call('HSET', KEYS[1], all[i], cjson.encode(entry))
    end
end
return 1
`;

const purgeScript = `
local purged = {}
local all = redis.call('HGETALL', KEYS[1])
for i = 1, #all, 2 do
    if cjson.decode(all[i + 1]).holder == ARGV[1] then
        redis.call('HDEL', KEYS[1], all[i])
        purged[#purged + 1] = all[i]
    end
end
return purged
`;

const liveLocksScript = `${clock}
local result = {}
local all = redis.call('HGETALL', KEYS[1])
for i = 1, #all, 2 do
    if tonumber(cjson.decode(all[i + 1]).expiresAt) > now then
        result[#result + 1] = all[i + 1]
    end
end
return result
`;

const joinScript = `${clock}
local isNew = redis.call('ZSCORE', KEYS[1], ARGV[1]) == false
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
redis.call('PEXPIRE', KEYS[1], ${dayMs})
redis.call('PEXPIRE', KEYS[2], ${dayMs})
if isNew then
    return 1
end
return 0
`;

const touchScript = `${clock}
for i = 1, #ARGV do
    redis.call('ZADD', KEYS[1], 'XX', now, ARGV[i])
end
return 1
`;

const leaveScript = `
local raw = redis.call('HGET', KEYS[2], ARGV[1])
if not raw or cjson.decode(raw).connId ~= ARGV[2] then
    return 0
end
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[1], ARGV[1])
return 1
`;

const sweepScript = `${clock}
local stale = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', '(' .. (now - tonumber(ARGV[1])))
local removed = {}
for _, clientId in ipairs(stale) do
    if redis.call('ZREM', KEYS[1], clientId) == 1 then
        local raw = redis.call('HGET', KEYS[2], clientId)
        redis.call('HDEL', KEYS[2], clientId)
        if raw then
            removed[#removed + 1] = raw
        end
    end
end
return removed
`;

const recordTouchedScript = `
for i = 2, #ARGV do
    local current = tonumber(redis.call('HGET', KEYS[1], ARGV[i]) or '0')
    if current < tonumber(ARGV[1]) then
        redis.call('HSET', KEYS[1], ARGV[i], ARGV[1])
    end
end
redis.call('PEXPIRE', KEYS[1], ${dayMs})
return 1
`;

const parseLock = (raw: unknown) => JSON.parse(String(raw)) as StoredLock;
const lockArgument = (lock: LiveLock) => JSON.stringify({ ...lock, key: "", expiresAt: 0 });

export class RedisLiveStore implements LiveStore {
    private client: RedisClient;
    private subscriber: RedisClient | null = null;
    private ready: Promise<unknown>;
    private listeners = new Map<number, Set<BoardEventListener>>();

    constructor(url: string) {
        // 끊긴 동안 명령을 쌓아 두지 않고 바로 실패시킨다. 호출하는 쪽이 기다리지 않고 대체 경로로 간다.
        this.client = createClient({ url, disableOfflineQueue: true });
        this.client.on("error", (error) => console.error("live.redis_error", error));
        this.ready = this.client.connect();
        this.ready.catch((error: unknown) => console.error("live.redis_connect_failed", error));
    }

    private async run(script: string, keys: string[], args: string[]) {
        await this.ready;
        return this.client.eval(script, { keys, arguments: args });
    }

    private async subscriberClient() {
        if (!this.subscriber) {
            const subscriber = this.client.duplicate();
            subscriber.on("error", (error) => console.error("live.redis_subscriber_error", error));
            this.subscriber = subscriber;
            await subscriber.connect();
        }
        return this.subscriber;
    }

    async publish(boardId: number, event: BoardEvent) {
        await this.ready;
        await this.client.publish(channelOf(boardId), JSON.stringify(event));
    }

    async subscribe(boardId: number, listener: BoardEventListener) {
        const subscriber = await this.subscriberClient();
        let listeners = this.listeners.get(boardId);
        if (!listeners) {
            const created = new Set<BoardEventListener>();
            listeners = created;
            this.listeners.set(boardId, created);
            await subscriber.subscribe(channelOf(boardId), (message) => {
                let event: BoardEvent;
                try {
                    event = JSON.parse(message) as BoardEvent;
                } catch {
                    return;
                }
                for (const each of [...created]) {
                    each(event);
                }
            });
        }
        listeners.add(listener);
        return async () => {
            const current = this.listeners.get(boardId);
            current?.delete(listener);
            if (current && current.size === 0) {
                this.listeners.delete(boardId);
                await subscriber.unsubscribe(channelOf(boardId));
            }
        };
    }

    async acquire(boardId: number, lock: LiveLock, keys: string[], ttlMs: number): Promise<AcquireResult> {
        const result = await this.run(acquireScript, [locksKey(boardId)],
            [lock.holder, String(ttlMs), lockArgument(lock), ...keys]) as [number, string?];
        if (Number(result[0]) === 1) {
            return { granted: true };
        }
        return { granted: false, conflict: result[1] ? parseLock(result[1]) : null };
    }

    async release(boardId: number, holder: string, keys: string[]) {
        return (await this.run(releaseScript, [locksKey(boardId)], [holder, ...keys]) as string[]).map(String);
    }

    async renew(boardId: number, holders: string[], ttlMs: number) {
        if (holders.length === 0) {
            return;
        }
        await this.run(renewScript, [locksKey(boardId)], [String(ttlMs), ...holders]);
    }

    async reassert(boardId: number, lock: LiveLock, keys: string[], ttlMs: number) {
        if (keys.length === 0) {
            return { held: [], lost: [] };
        }
        const [held, lost] = await this.run(reassertScript, [locksKey(boardId)],
            [lock.holder, String(ttlMs), lockArgument(lock), ...keys]) as [string[], string[]];
        return { held: (held ?? []).map(String), lost: (lost ?? []).map(String) };
    }

    async purgeHolder(boardId: number, holder: string) {
        return (await this.run(purgeScript, [locksKey(boardId)], [holder]) as string[]).map(String);
    }

    async locks(boardId: number) {
        return (await this.run(liveLocksScript, [locksKey(boardId)], []) as string[]).map(parseLock);
    }

    async foreignLock(boardId: number, holder: string | null, keys: string[]) {
        if (keys.length === 0) {
            return null;
        }
        const raw = await this.run(foreignScript, [locksKey(boardId)], [holder ?? "", ...keys]);
        return raw ? parseLock(raw) : null;
    }

    async join(boardId: number, record: PresenceRecord) {
        const isNew = await this.run(joinScript, [presenceKey(boardId), presenceInfoKey(boardId)],
            [record.clientId, JSON.stringify(record)]);
        return Number(isNew) === 1;
    }

    async touch(boardId: number, clientIds: string[]) {
        if (clientIds.length === 0) {
            return;
        }
        await this.run(touchScript, [presenceKey(boardId)], clientIds);
    }

    async leave(boardId: number, clientId: string, connId: string) {
        const removed = await this.run(leaveScript, [presenceKey(boardId), presenceInfoKey(boardId)], [clientId, connId]);
        return Number(removed) === 1;
    }

    async peers(boardId: number) {
        await this.ready;
        const entries = await this.client.hGetAll(presenceInfoKey(boardId));
        return Object.values(entries).map((raw) => JSON.parse(String(raw)) as PresenceRecord);
    }

    async sweep(boardId: number, staleMs: number) {
        const removed = await this.run(sweepScript, [presenceKey(boardId), presenceInfoKey(boardId)], [String(staleMs)]);
        return (removed as string[]).map((raw) => JSON.parse(String(raw)) as PresenceRecord);
    }

    async recordTouched(boardId: number, keys: string[], revision: number) {
        if (keys.length === 0) {
            return;
        }
        await this.run(recordTouchedScript, [touchedKey(boardId)], [String(revision), ...keys]);
    }

    async keyRevision(boardId: number, keys: string[]) {
        if (keys.length === 0) {
            return 0;
        }
        await this.ready;
        const values = await this.client.hmGet(touchedKey(boardId), keys);
        return values.reduce<number>((highest, value) => Math.max(highest, Number(value ?? 0)), 0);
    }

    async close() {
        await this.subscriber?.quit().catch(() => undefined);
        await this.client.quit().catch(() => undefined);
    }
}

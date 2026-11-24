import { createClient } from "redis";
import type { LiveLock } from "../protocol";
import type { AcquireResult, LiveStore, StoredLock } from "./types";

type RedisClient = ReturnType<typeof createClient>;

const dayMs = "86400000";
const locksKey = (boardId: number) => `mdr:locks:${boardId}`;
const touchedKey = (boardId: number) => `mdr:touched:${boardId}`;
const peerRoomKey = (boardId: number) => `mdr:peer-room:${boardId}`;

const writePeerRoomScript = `
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
if ARGV[2] == '' then
    redis.call('DEL', KEYS[1])
else
    redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
end
return 1
`;

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
    if tonumber(entry.expiresAt) > now and holders[entry.holder] then
        entry.expiresAt = now + tonumber(ARGV[1])
        redis.call('HSET', KEYS[1], all[i], cjson.encode(entry))
    end
end
return 1
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
    private ready: Promise<unknown>;

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

    async readPeerRoom(boardId: number) {
        await this.ready;
        return this.client.get(peerRoomKey(boardId));
    }

    async writePeerRoom(boardId: number, expected: string | null, data: string | null, ttlMs: number) {
        const written = await this.run(writePeerRoomScript, [peerRoomKey(boardId)], [expected ?? "", data ?? "", String(ttlMs)]);
        return Number(written) === 1;
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
        await this.client.quit().catch(() => undefined);
    }
}

import { afterAll, describe, expect, it } from "vitest";
import { MemoryLiveStore } from "@/lib/live/store/memory-store";
import { RedisLiveStore } from "@/lib/live/store/redis-store";
import type { LiveStore } from "@/lib/live/store/types";
import type { LiveLock } from "@/lib/live/protocol";

const lock = (userId: number, clientId: string, intent: LiveLock["intent"] = "move"): LiveLock => ({
    key: "", holder: `${userId}:${clientId}`, clientId, userId, email: `user${userId}@example.com`, intent, color: "#000",
});

const alice = lock(1, "a");
const bob = lock(2, "b");
const redisUrl = process.env.REDIS_TEST_URL;
const stores: [string, () => LiveStore][] = [["memory", () => new MemoryLiveStore()]];
if (redisUrl) {
    stores.push(["redis", () => new RedisLiveStore(redisUrl)]);
}

let nextBoard = Math.floor(Math.random() * 1_000_000) + 1_000_000;
const created: LiveStore[] = [];

afterAll(async () => {
    await Promise.all(created.map((store) => store.close()));
});

describe.each(stores)("Live 저장소 계약 (%s)", (_name, create) => {
    const setup = () => {
        const store = create();
        created.push(store);
        return { store, boardId: nextBoard++ };
    };

    it("남이 쥔 키는 거절하고 충돌한 잠금의 주인을 알려 준다", async () => {
        const { store, boardId } = setup();
        expect(await store.acquire(boardId, alice, ["memo:1"], 20_000)).toEqual({ granted: true });

        const denied = await store.acquire(boardId, bob, ["memo:2", "memo:1"], 20_000);
        expect(denied.granted).toBe(false);
        expect(denied.granted === false && denied.conflict?.email).toBe("user1@example.com");
        expect(await store.foreignLock(boardId, bob.holder, ["memo:2"])).toBeNull();
    });

    it("여러 키는 전부 잡거나 하나도 잡지 않는다", async () => {
        const { store, boardId } = setup();
        await store.acquire(boardId, alice, ["memo:2"], 20_000);
        await store.acquire(boardId, bob, ["memo:1", "memo:2"], 20_000);

        expect((await store.locks(boardId)).map((entry) => entry.key)).toEqual(["memo:2"]);
    });

    it("보드 전체 잠금은 다른 사람의 잠금이 하나도 없을 때만 잡히고, 잡히면 모든 키를 막는다", async () => {
        const { store, boardId } = setup();
        await store.acquire(boardId, alice, ["memo:1"], 20_000);
        expect((await store.acquire(boardId, bob, ["board:*"], 20_000)).granted).toBe(false);

        await store.release(boardId, alice.holder, ["memo:1"]);
        expect((await store.acquire(boardId, bob, ["board:*"], 20_000)).granted).toBe(true);
        expect((await store.acquire(boardId, alice, ["image:9"], 20_000)).granted).toBe(false);
    });

    it("자기 잠금은 다시 잡을 수 있고, 주인만 풀 수 있다", async () => {
        const { store, boardId } = setup();
        await store.acquire(boardId, alice, ["memo:1"], 20_000);
        expect((await store.acquire(boardId, lock(1, "a", "edit"), ["memo:1"], 20_000)).granted).toBe(true);
        expect((await store.locks(boardId))[0].intent).toBe("edit");

        expect(await store.release(boardId, bob.holder, ["memo:1"])).toEqual([]);
        expect(await store.release(boardId, alice.holder, ["memo:1"])).toEqual(["memo:1"]);
        expect(await store.locks(boardId)).toEqual([]);
    });

    it("만료된 잠금은 새로 획득할 수 있다", async () => {
        const { store, boardId } = setup();
        await store.acquire(boardId, alice, ["memo:1"], 1);
        await new Promise((resolve) => setTimeout(resolve, 15));
        await store.renew(boardId, [alice.holder], 20_000);
        expect(await store.locks(boardId)).toEqual([]);

        expect(await store.acquire(boardId, bob, ["memo:1"], 20_000)).toEqual({ granted: true });
    });

    it("연장과 정리는 주인 단위로 동작한다", async () => {
        const { store, boardId } = setup();
        await store.acquire(boardId, alice, ["memo:1", "memo:2"], 50);
        await store.renew(boardId, [alice.holder], 20_000);
        await new Promise((resolve) => setTimeout(resolve, 80));
        expect(await store.locks(boardId)).toHaveLength(2);

        expect((await store.release(boardId, alice.holder, ["memo:1", "memo:2"])).sort()).toEqual(["memo:1", "memo:2"]);
        expect(await store.locks(boardId)).toEqual([]);
    });

    it("키별 최신 판 번호는 줄어들지 않는다", async () => {
        const { store, boardId } = setup();
        await store.recordTouched(boardId, ["memo:1"], 5);
        await store.recordTouched(boardId, ["memo:1", "memo:2"], 3);

        expect(await store.keyRevision(boardId, ["memo:1"])).toBe(5);
        expect(await store.keyRevision(boardId, ["memo:2", "memo:9"])).toBe(3);
    });

});

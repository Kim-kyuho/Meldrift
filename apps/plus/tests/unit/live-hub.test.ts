import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveHub } from "@/lib/live/server/hub";
import type { LiveIdentity } from "@/lib/live/server/identity";
import type { LiveSocket } from "@/lib/live/server/socket";
import { MemoryLiveStore } from "@/lib/live/store/memory-store";
import type { ClientMessage, ServerMessage } from "@/lib/live/protocol";

vi.mock("@/lib/live/server/identity", () => ({
    resolveLiveIdentity: vi.fn(),
    boardHeadRevision: vi.fn(async () => 0),
}));

class FakeSocket implements LiveSocket {
    sent: ServerMessage[] = [];
    closedWith: number | null = null;
    private messageListener: ((data: string) => void) | null = null;
    private closeListener: (() => void) | null = null;

    send(data: string) {
        this.sent.push(JSON.parse(data) as ServerMessage);
    }

    close(code: number) {
        if (this.closedWith === null) {
            this.closedWith = code;
            this.closeListener?.();
        }
    }

    onMessage(listener: (data: string) => void) {
        this.messageListener = listener;
    }

    onClose(listener: () => void) {
        this.closeListener = listener;
    }

    deliver(message: ClientMessage | Record<string, unknown>) {
        this.messageListener?.(JSON.stringify(message));
    }

    of<T extends ServerMessage["t"]>(type: T) {
        return this.sent.filter((message) => message.t === type) as Extract<ServerMessage, { t: T }>[];
    }
}

const clientIds = {
    alice: "0f8fad5b-d9cb-469f-a165-70867728950e",
    bob: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    guest: "16fd2706-8baf-433b-82eb-8c7fada847da",
};

function identity(name: keyof typeof clientIds, overrides: Partial<LiveIdentity> = {}): LiveIdentity {
    const userId = name === "guest" ? null : name === "alice" ? 1 : 2;
    return {
        boardId: 7,
        clientId: clientIds[name],
        userId,
        email: userId === null ? null : `${name}@example.com`,
        role: userId === null ? "guest" : "editor",
        canEdit: userId !== null,
        seesEmails: userId !== null,
        color: "#123456",
        token: { b: 7, u: userId, s: "hash", c: clientIds[name], e: Date.now() + 60_000 },
        ...overrides,
    };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Live 허브와 연결", () => {
    let hub: LiveHub;

    beforeEach(() => {
        hub = new LiveHub(new MemoryLiveStore(), { maxDurationMs: 300_000, headRevision: async () => 12 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function join(name: keyof typeof clientIds, overrides: Partial<LiveIdentity> = {}) {
        const socket = new FakeSocket();
        hub.attach(socket, identity(name, overrides));
        socket.deliver({ t: "hello", v: 1, clientId: clientIds[name], held: [], revision: 0 });
        await vi.waitFor(() => expect(socket.of("welcome")).toHaveLength(1));
        return socket;
    }

    it("hello에 접속자·잠금·최신 판 번호를 담아 환영하고, 다른 사람에게 입장을 알린다", async () => {
        const alice = await join("alice");
        const bob = await join("bob");

        const [welcome] = bob.of("welcome");
        expect(welcome.head).toBe(12);
        expect(welcome.peers.map((peer) => peer.email).sort()).toEqual(["alice@example.com", "bob@example.com"]);
        await vi.waitFor(() => expect(alice.of("presence.join").map((event) => event.peer.email)).toContain("bob@example.com"));
    });

    it("공유 멤버가 아닌 사람에게는 이메일을 가려서 보낸다", async () => {
        await join("alice");
        const outsider = await join("bob", { role: "viewer", canEdit: false, seesEmails: false });

        const emails = outsider.of("welcome")[0].peers.map((peer) => peer.email);
        expect(emails).toContain("a***@example.com");
        expect(emails).not.toContain("alice@example.com");
        expect(emails).toContain("bob@example.com");
    });

    it("남이 쥔 카드는 거절하고 주인의 이메일을 알려 준다", async () => {
        const alice = await join("alice");
        const bob = await join("bob");

        alice.deliver({ t: "lock.acquire", reqId: 1, keys: ["memo:a"], intent: "move" });
        await vi.waitFor(() => expect(alice.of("lock.result")).toEqual([{ t: "lock.result", reqId: 1, granted: true, keyRevision: 0 }]));
        await vi.waitFor(() => expect(bob.of("lock.acquired")[0]?.locks[0]).toMatchObject({ key: "memo:a", email: "alice@example.com" }));

        bob.deliver({ t: "lock.acquire", reqId: 2, keys: ["memo:a"], intent: "edit" });
        await vi.waitFor(() => expect(bob.of("lock.result")).toHaveLength(1));
        const [result] = bob.of("lock.result");
        expect(result.granted).toBe(false);
        expect(!result.granted && result.conflict?.email).toBe("alice@example.com");

        alice.deliver({ t: "lock.release", keys: ["memo:a"] });
        await vi.waitFor(() => expect(bob.of("lock.released")).toEqual([
            { t: "lock.released", clientId: clientIds.alice, keys: ["memo:a"] },
        ]));
    });

    it("편집 권한이 없는 연결은 잠금을 얻지 못한다", async () => {
        const viewer = await join("bob", { canEdit: false, role: "viewer" });

        viewer.deliver({ t: "lock.acquire", reqId: 3, keys: ["memo:a"], intent: "move" });
        await vi.waitFor(() => expect(viewer.of("lock.result")).toEqual([
            { t: "lock.result", reqId: 3, granted: false, conflict: null },
        ]));
    });

    it("커서와 드래그 위치를 50ms 프레임으로 묶어 다른 사람에게만 보낸다", async () => {
        const alice = await join("alice");
        const bob = await join("bob");
        alice.deliver({ t: "lock.acquire", reqId: 1, keys: ["memo:a"], intent: "move" });
        await vi.waitFor(() => expect(alice.of("lock.result")).toHaveLength(1));

        alice.deliver({ t: "cursor", x: 10, y: 20 });
        alice.deliver({ t: "cursor", x: 11, y: 21 });
        alice.deliver({ t: "transient", items: [
            { key: "memo:a", x: 1, y: 2, width: 3, height: 4 },
            { key: "memo:not-held", x: 1, y: 2, width: 3, height: 4 },
        ] });

        await vi.waitFor(() => expect(bob.of("frame")).toHaveLength(1));
        const [frame] = bob.of("frame");
        expect(frame.cursors).toEqual([{ clientId: clientIds.alice, x: 11, y: 21 }]);
        expect(frame.transients.map((item) => item.key)).toEqual(["memo:a"]);
        await settle();
        expect(alice.of("frame")).toEqual([]);
    });

    it("나가면 남은 사람에게 알린다", async () => {
        const alice = await join("alice");
        const bob = await join("bob");

        bob.close(1000);
        await vi.waitFor(() => expect(alice.of("presence.leave")).toEqual([
            { t: "presence.leave", clientId: clientIds.bob },
        ]));
        expect(hub.connectionCount()).toBe(1);
    });

    it("토큰과 다른 clientId, 잘못된 메시지, hello 전 메시지는 연결을 닫는다", async () => {
        const mismatch = new FakeSocket();
        hub.attach(mismatch, identity("alice"));
        mismatch.deliver({ t: "hello", v: 1, clientId: clientIds.bob, held: [], revision: 0 });
        await vi.waitFor(() => expect(mismatch.closedWith).toBe(4400));

        const early = new FakeSocket();
        hub.attach(early, identity("alice"));
        early.deliver({ t: "cursor", x: 1, y: 1 });
        await vi.waitFor(() => expect(early.closedWith).toBe(4400));

        const invalid = await join("bob");
        invalid.deliver({ t: "lock.acquire", reqId: 1, keys: ["../../etc"], intent: "move" });
        await vi.waitFor(() => expect(invalid.closedWith).toBe(4400));
    });

    it("재연결한 hello의 잠금 목록을 다시 주장하고, 남이 가져간 키는 잃었다고 알린다", async () => {
        const bob = await join("bob");
        bob.deliver({ t: "lock.acquire", reqId: 1, keys: ["memo:taken"], intent: "move" });
        await vi.waitFor(() => expect(bob.of("lock.result")).toHaveLength(1));

        const alice = new FakeSocket();
        hub.attach(alice, identity("alice"));
        alice.deliver({ t: "hello", v: 1, clientId: clientIds.alice, held: ["memo:taken", "memo:mine"], revision: 0 });
        await vi.waitFor(() => expect(alice.of("lock.lost")).toEqual([{ t: "lock.lost", keys: ["memo:taken"] }]));
        expect(alice.of("welcome")[0].locks.map((entry) => entry.key).sort()).toEqual(["memo:mine", "memo:taken"]);
    });
});

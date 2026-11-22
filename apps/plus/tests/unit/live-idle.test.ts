import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardDatabaseClient } from "@meldrift/board-data/browser-db/client";
import { LiveSession, liveFallbackMs } from "@/lib/live/client/live-session";
import { LiveRuntime } from "@/lib/live/client/runtime";

class FakeWebSocket {
    static OPEN = 1;
    static instances: FakeWebSocket[] = [];
    readyState = 0;
    sent: string[] = [];
    closedWith: number | null = null;
    private listeners = new Map<string, ((event: unknown) => void)[]>();

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    addEventListener(type: string, listener: (event: unknown) => void) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }

    emit(type: string, event: unknown = {}) {
        this.listeners.get(type)?.forEach((listener) => listener(event));
    }

    open() {
        this.readyState = 1;
        this.emit("open");
    }

    receive(message: object) {
        this.emit("message", { data: JSON.stringify(message) });
    }

    send(data: string) {
        this.sent.push(data);
    }

    close(code = 1000) {
        this.closedWith = code;
        this.readyState = 3;
        this.emit("close", { code });
    }
}

const welcome = (clientId: string) => ({
    t: "welcome", connId: "c", head: 0, rotateAt: Date.now() + 300_000, canEdit: true, locks: [],
    self: { clientId, userId: 1, email: "a@example.com", role: "editor", color: "#000", joinedAt: 0 },
    peers: [],
});

const flush = async () => {
    for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
    }
};

describe("Live 유휴 연결 종료", () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal("WebSocket", FakeWebSocket);
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "t" }), { status: 200 })));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("쉬는 동안에는 소켓을 닫고 다시 연결하지 않으며, 다시 열면 새 소켓으로 hello를 보낸다", async () => {
        const session = new LiveSession({
            boardId: 7, boardEndpoint: "/api/boards/7", clientId: "0f8fad5b-d9cb-469f-a165-70867728950e",
            heldKeys: () => [], revision: () => 3, onWelcome: vi.fn(), onCommit: vi.fn(), onLockLost: vi.fn(),
        });
        session.start();
        await flush();
        const first = FakeWebSocket.instances[0];
        first.open();
        first.receive(welcome("0f8fad5b-d9cb-469f-a165-70867728950e"));
        expect(session.getState().status).toBe("open");

        session.pause();
        expect(first.closedWith).toBe(1000);
        expect(session.getState().status).toBe("idle");
        await flush();
        expect(FakeWebSocket.instances).toHaveLength(1);

        session.resume();
        await flush();
        const second = FakeWebSocket.instances[1];
        expect(second).toBeDefined();
        second.open();
        expect(JSON.parse(second.sent[0])).toMatchObject({ t: "hello", revision: 3 });
        session.stop();
    });

    it("입력이 10분 없으면 끊고, 다음 입력에서 다시 연결한다", async () => {
        vi.useFakeTimers();
        const database = { pendingKeys: vi.fn(async () => []) } as unknown as BoardDatabaseClient;
        const runtime = new LiveRuntime({
            boardId: 7, boardEndpoint: "/api/boards/7", database, initialRevision: 0, sync: null, onBlocked: vi.fn(),
        });
        const pause = vi.spyOn(runtime.session, "pause");
        const resume = vi.spyOn(runtime.session, "resume");
        runtime.start();

        await vi.advanceTimersByTimeAsync(9 * 60_000);
        window.dispatchEvent(new Event("pointermove"));
        await vi.advanceTimersByTimeAsync(9 * 60_000);
        expect(pause).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(2 * 60_000);
        expect(pause).toHaveBeenCalledOnce();
        expect(runtime.session.getState().status).toBe("idle");

        window.dispatchEvent(new Event("keydown"));
        expect(resume).toHaveBeenCalledOnce();
        runtime.stop();
    });

    it("10초 안에 연결되지 않으면 잠금 없이 편집하는 대체 모드로 넘기고, 연결되면 돌아온다", async () => {
        vi.useFakeTimers();
        let tokenWorks = false;
        vi.stubGlobal("fetch", vi.fn(async () => tokenWorks
            ? new Response(JSON.stringify({ token: "t" }), { status: 200 })
            : new Response("{}", { status: 503 })));
        const session = new LiveSession({
            boardId: 7, boardEndpoint: "/api/boards/7", clientId: "0f8fad5b-d9cb-469f-a165-70867728950e",
            heldKeys: () => [], revision: () => 0, onWelcome: vi.fn(), onCommit: vi.fn(), onLockLost: vi.fn(),
        });
        session.start();
        await vi.advanceTimersByTimeAsync(liveFallbackMs - 1000);
        expect(session.getState().status).toBe("reconnecting");

        await vi.advanceTimersByTimeAsync(1500);
        expect(session.getState().status).toBe("unavailable");

        tokenWorks = true;
        const before = FakeWebSocket.instances.length;
        for (let waited = 0; waited < 60 && FakeWebSocket.instances.length === before; waited += 1) {
            await vi.advanceTimersByTimeAsync(1000);
        }
        const socket = FakeWebSocket.instances.at(-1)!;
        expect(FakeWebSocket.instances.length).toBeGreaterThan(before);
        socket.open();
        socket.receive(welcome("0f8fad5b-d9cb-469f-a165-70867728950e"));
        expect(session.getState().status).toBe("open");
        session.stop();
    });

    it("대체 모드에서는 잠금 요청을 기다리지 않고 바로 허용한다", async () => {
        const database = { pendingKeys: vi.fn(async () => []) } as unknown as BoardDatabaseClient;
        const runtime = new LiveRuntime({
            boardId: 7, boardEndpoint: "/api/boards/7", database, initialRevision: 0, sync: null, onBlocked: vi.fn(),
        });
        vi.spyOn(runtime.session, "getState").mockReturnValue({ ...runtime.session.getState(), status: "unavailable" });

        expect(await runtime.acquire(["memo:a"], "edit")).toBeNull();
        runtime.stop();
    });

    it("화면이 구독하기 전에 반영된 원격 변경을 구독하는 순간 순서대로 넘긴다", async () => {
        const database = { pendingKeys: vi.fn(async () => []) } as unknown as BoardDatabaseClient;
        const runtime = new LiveRuntime({
            boardId: 7, boardEndpoint: "/api/boards/7", database, initialRevision: 0, sync: null, onBlocked: vi.fn(),
        });
        const deliver = (runtime as unknown as { deliverRemote: (applied: unknown) => void }).deliverRemote.bind(runtime);
        deliver({ seq: 1, patch: { upserts: {}, deletes: [], keys: ["memo:a"] } });
        deliver({ seq: 2, patch: { upserts: {}, deletes: [], keys: ["memo:b"] } });

        const strictModeProbe = vi.fn();
        runtime.onRemote(strictModeProbe)();
        const received: number[] = [];
        runtime.onRemote((applied) => received.push(applied.seq));
        await Promise.resolve();
        await Promise.resolve();

        expect(strictModeProbe).not.toHaveBeenCalled();
        expect(received).toEqual([1, 2]);
        runtime.stop();
    });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardDatabaseClient } from "@meldrift/board-data/browser-db/client";
import { LiveSession, liveFallbackMs } from "@/lib/live/client/live-session";
import { LiveRuntime } from "@/lib/live/client/runtime";
import type { RoomStatus } from "@/lib/live/p2p/protocol";

const clientId = "0f8fad5b-d9cb-469f-a165-70867728950e";
const token = "test-live-token";
const boardEndpoint = "/api/boards/7";
const database = () => ({ pendingKeys: vi.fn(async () => []) }) as unknown as BoardDatabaseClient;
const session = () => new LiveSession({
    boardEndpoint, clientId, heldKeys: () => [], onWelcome: vi.fn(), onHead: vi.fn(), onLockLost: vi.fn(),
});

function reply(id: string) {
    const self = { clientId: id, userId: 1, email: "a@example.com", role: "editor" as const, color: "#000", joinedAt: 0 };
    return {
        epoch: "6d6492cc-5c19-468c-9946-88d7a55ed580", hostId: id, self,
        peers: [self], negotiations: [], locks: [], head: 3,
    } satisfies RoomStatus;
}

function mockRoom(available = () => true) {
    let current = reply(clientId);
    const requests: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        requests.push({ url: input, body });
        if (!available()) {
            return Response.json({ message: "Offline" }, { status: 503 });
        }
        if (input.endsWith("/token")) {
            current = reply(String(body.clientId));
            return Response.json({ token, expiresAt: Date.now() + 60_000, status: current });
        }
        return body.kind === "leave" ? Response.json({ ok: true }) : Response.json(current);
    }));
    return requests;
}

describe("Live 유휴 연결 종료", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("isSecureContext", true);
        vi.stubGlobal("RTCPeerConnection", class {});
        mockRoom();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("유휴 상태에서는 자리를 비우고, 돌아오면 새 접속으로 자동 입장한다", async () => {
        const requests = mockRoom();
        const live = session();
        live.start();
        await vi.advanceTimersByTimeAsync(1);
        expect(live.getState().status).toBe("open");

        live.pause();
        expect(live.getState().status).toBe("idle");
        expect(requests.at(-1)?.body).toEqual({ kind: "leave" });
        await vi.advanceTimersByTimeAsync(30_000);
        expect(requests).toHaveLength(2);

        live.resume();
        await vi.advanceTimersByTimeAsync(1);
        expect(live.getState().status).toBe("open");
        expect(requests[2].body.clientId).toBe(clientId);
        expect(requests[2].body.leaseId).not.toBe(requests[0].body.leaseId);
        live.stop();
    });

    it("입력이 10분 없으면 끊고, 다음 입력에서 다시 연결한다", async () => {
        const runtime = new LiveRuntime({ boardEndpoint, database: database(), initialRevision: 0, sync: null, onBlocked: vi.fn() });
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

    it("연결을 재시도하는 동안 대체 모드로 넘기고, 연결되면 돌아온다", async () => {
        let available = false;
        mockRoom(() => available);
        const live = session();
        live.start();

        await vi.advanceTimersByTimeAsync(liveFallbackMs - 1000);
        expect(live.getState().status).toBe("reconnecting");
        await vi.advanceTimersByTimeAsync(1500);
        expect(live.getState().status).toBe("unavailable");

        available = true;
        await vi.advanceTimersByTimeAsync(3000);
        expect(live.getState().status).toBe("open");
        live.stop();
    });

    it("대체 모드에서는 잠금 요청을 기다리지 않고 바로 허용한다", async () => {
        const runtime = new LiveRuntime({ boardEndpoint, database: database(), initialRevision: 0, sync: null, onBlocked: vi.fn() });
        vi.spyOn(runtime.session, "getState").mockReturnValue({ ...runtime.session.getState(), status: "unavailable" });
        expect(await runtime.acquire(["memo:a"], "edit")).toBeNull();
        runtime.stop();
    });

    it("화면이 구독하기 전에 반영된 원격 변경을 구독하는 순간 순서대로 넘긴다", async () => {
        const runtime = new LiveRuntime({ boardEndpoint, database: database(), initialRevision: 0, sync: null, onBlocked: vi.fn() });
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

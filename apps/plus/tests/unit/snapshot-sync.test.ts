import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SnapshotSync } from "@/lib/snapshot-sync";
import { createEmptyBoardSnapshot } from "@meldrift/board-data/board-state";
import type { BoardDatabaseClient } from "@meldrift/board-data/browser-db/client";
import type { StoredBoard } from "@meldrift/board-data/browser-db/protocol";
import { act, renderHook } from "@testing-library/react";
import { useBoardPersistence } from "@meldrift/ui/useBoardPersistence";

function setup() {
    let record: StoredBoard = { bytes: new ArrayBuffer(16), sync: { revision: 0, generation: 0, dirty: false, changedAt: 0 } };
    const database = {
        replace: vi.fn(async () => {
            record = { ...record, sync: { ...record.sync, generation: record.sync.generation + 1, dirty: true, changedAt: Date.now(), mutationId: "change-" + (record.sync.generation + 1) } };
        }),
        record: vi.fn(async () => structuredClone(record)),
        acknowledge: vi.fn(async (generation: number, revision: number) => {
            record.sync = { ...record.sync, revision, dirty: generation !== record.sync.generation };
        }),
        close: vi.fn(),
    };
    const status = vi.fn();
    const manager = new SnapshotSync(database as unknown as BoardDatabaseClient, "/api/boards/1/snapshot", status);
    return {
        manager,
        database,
        status,
        record: () => record,
        setBytes: (bytes: ArrayBuffer) => {
            record.bytes = bytes;
        },
    };
}

describe("스냅샷 동기화", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 1 }) }));
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("로컬 150ms 디바운스와 서버 3초 디바운스를 분리한다", async () => {
        const { manager, database } = setup();
        const onSave = (snapshot: ReturnType<typeof createEmptyBoardSnapshot>) => manager.save(snapshot);
        const onError = vi.fn();
        const initial = createEmptyBoardSnapshot();
        const { rerender, unmount } = renderHook(
            ({ snapshot }) => useBoardPersistence({
                snapshot, savePaused: false, onSave, onError, skipInitialSave: true,
            }),
            { initialProps: { snapshot: initial } },
        );
        const latest = { ...initial, strokes: [] };
        rerender({ snapshot: latest });
        await act(async () => vi.advanceTimersByTimeAsync(149));
        expect(database.replace).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();

        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(database.replace).toHaveBeenCalledExactlyOnceWith(latest, true);
        await act(async () => vi.advanceTimersByTimeAsync(2999));
        expect(fetch).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(fetch).toHaveBeenCalledOnce();
        expect(onError).not.toHaveBeenCalled();
        unmount();
        await manager.close();
    });

    it("마지막 IndexedDB 저장 완료를 기준으로 디바운스한다", async () => {
        const { manager, database } = setup();
        await manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(2000);
        await manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(2999);
        expect(fetch).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(fetch).toHaveBeenCalledOnce();
        expect(database.acknowledge).toHaveBeenCalledWith(2, 1);
        await manager.close();
    });

    it("대기 중인 로컬 트랜잭션이 완료되기 전에는 업로드하지 않는다", async () => {
        const { manager, database } = setup();
        let finish!: () => void;
        database.replace.mockImplementationOnce(() => new Promise<void>((resolve) => {
            finish = resolve;
        }));
        const saving = manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(5000);
        expect(fetch).not.toHaveBeenCalled();
        finish();
        await saving;
        expect(fetch).not.toHaveBeenCalled();
        await manager.close();
    });

    it("업로드를 순차 실행하고 전송 중 편집을 미저장 상태로 유지한다", async () => {
        const { manager, database, record } = setup();
        let finish!: (response: Response) => void;
        vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => {
            finish = resolve;
        }) as Promise<Response>);
        await manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(3000);
        await manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(3000);
        expect(fetch).toHaveBeenCalledOnce();
        finish({ ok: true, json: async () => ({ revision: 1 }) } as Response);
        await vi.advanceTimersByTimeAsync(1);
        expect(database.acknowledge).toHaveBeenNthCalledWith(1, 1, 1);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(vi.mocked(fetch).mock.calls[1][1]?.headers).toMatchObject({ "X-Snapshot-Revision": "1" });
        expect(record().sync.dirty).toBe(false);
        await manager.close();
    });

    it("응답 유실 재시도 시 변경 요청 식별자를 유지한다", async () => {
        const { manager, record } = setup();
        vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
        await manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(3000);
        expect(record().sync.dirty).toBe(true);
        await vi.advanceTimersByTimeAsync(10000);
        expect(fetch).toHaveBeenCalledTimes(2);
        const calls = vi.mocked(fetch).mock.calls;
        expect(calls[0][1]?.headers).toEqual(calls[1][1]?.headers);
        expect(record().sync.dirty).toBe(false);
        await manager.close();
    });

    it.each([401, 403, 404, 409])("HTTP %s 응답 시 로컬 데이터를 버리지 않고 업로드를 중단한다", async (code) => {
        const { manager, record, status } = setup();
        vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: code, json: async () => ({ message: "blocked" }) } as Response);
        await manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(30000);
        expect(fetch).toHaveBeenCalledOnce();
        expect(record().sync.dirty).toBe(true);
        expect(status).toHaveBeenLastCalledWith("blocked", "blocked");
        await manager.close();
    });

    it("크기를 초과한 스냅샷은 로컬에 유지한다", async () => {
        const { manager, record, setBytes, status } = setup();
        setBytes(new ArrayBuffer(4 * 1024 * 1024 + 1));
        await manager.save(createEmptyBoardSnapshot());
        await vi.advanceTimersByTimeAsync(3000);
        expect(fetch).not.toHaveBeenCalled();
        expect(record().sync.dirty).toBe(true);
        expect(status).toHaveBeenLastCalledWith("error", expect.stringContaining("4 MiB"));
        await manager.close();
    });
});

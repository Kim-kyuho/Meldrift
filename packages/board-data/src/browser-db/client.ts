import { defaultBoard, type BoardInfo, type BoardSnapshot } from "../board-state";
import type {
    BrowserDbPayload, BrowserDbRequest, BrowserDbResponse, OutboxBatch, OutboxState, RemoteApplied, StoredAsset,
    StoredBoard, TransferredAsset,
} from "./protocol";
import type { BoardOperation } from "../board-delta";

export type ReplaceOptions = { remoteSeq?: number; deferredKeys?: string[] };

export function createBoardDatabase(storageName: string, board: BoardInfo) {
    let worker: Worker | null = null;
    let nextRequestId = 1;
    let resetInProgress = false;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

    function close() {
        worker?.terminate();
        worker = null;
        pending.forEach(({ reject }) => reject(new Error("Board database was closed.")));
        pending.clear();
    }

    function request<T>(payload: BrowserDbPayload, transfer: Transferable[] = []) {
        return new Promise<T>((resolve, reject) => {
            const id = nextRequestId++;
            try {
                if (!worker) {
                    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
                    worker.addEventListener("message", (event: MessageEvent<BrowserDbResponse>) => {
                        const response = event.data;
                        const entry = pending.get(response.id);
                        if (!entry) {
                            return;
                        }
                        pending.delete(response.id);
                        if (response.ok) {
                            entry.resolve(response.value);
                        } else {
                            entry.reject(new Error(response.error));
                        }
                    });
                    worker.addEventListener("error", close);
                    void navigator.storage?.persist?.().catch(() => false);
                }
                pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
                worker.postMessage({ ...payload, id, storageName, board } as BrowserDbRequest, transfer);
            } catch (error) {
                pending.delete(id);
                reject(error);
            }
        });
    }

    return {
        load: (options?: { readOnly?: boolean }) => request<BoardSnapshot>({ type: "load", ...options }),
        replace: (snapshot: BoardSnapshot, dirty = false, options: ReplaceOptions = {}) => resetInProgress
            ? Promise.resolve()
            : request<void>({ type: "replace", snapshot, dirty, ...options }),
        export: () => request<ArrayBuffer>({ type: "export" }),
        encode: (snapshot: BoardSnapshot) => request<ArrayBuffer>({ type: "encode", snapshot }),
        decode: (bytes: ArrayBuffer, expectedBoardId?: number) =>
            request<BoardSnapshot>({ type: "decode", bytes, expectedBoardId }, [bytes]),
        import: (bytes: ArrayBuffer, revision = 0) =>
            request<BoardSnapshot>({ type: "import", bytes, revision }, [bytes]),
        record: () => request<StoredBoard>({ type: "record" }),
        acknowledge: (generation: number, revision: number) =>
            request<void>({ type: "acknowledge", generation, revision }),
        seed: (snapshot: BoardSnapshot, revision: number) =>
            request<BoardSnapshot>({ type: "seed", snapshot, revision }),
        commitOutbox: (claim: number, generation: number, revision: number | null) =>
            request<void>({ type: "commitOutbox", claim, generation, revision }),
        applyRemote: (operations: BoardOperation[], revision: number, assets: TransferredAsset[]) =>
            request<RemoteApplied>(
                { type: "applyRemote", operations, revision, assets },
                assets.map((asset) => asset.data),
            ),
        advanceRevision: (revision: number) => request<void>({ type: "advanceRevision", revision }),
        pendingKeys: () => request<string[]>({ type: "pendingKeys" }),
        resetRemoteLog: () => request<void>({ type: "resetRemoteLog" }),
        asset: (assetId: string) => request<StoredAsset | null>({ type: "asset", assetId }),
        outbox: () => request<OutboxState>({ type: "outbox" }),
        claimOutbox: (limit: number) => request<OutboxBatch>({ type: "claimOutbox", limit }),
        releaseOutbox: (claim: number) => request<void>({ type: "releaseOutbox", claim }),
        clearOutbox: (claim: number) => request<void>({ type: "clearOutbox", claim }),
        reset: async () => {
            if (resetInProgress) {
                return;
            }
            resetInProgress = true;
            try {
                await request<void>({ type: "reset" });
            } catch (error) {
                resetInProgress = false;
                throw error;
            }
        },
        close,
        closeWhenIdle: async () => {
            try {
                if (worker) {
                    await request<void>({ type: "flush" });
                }
            } finally {
                close();
            }
        },
    };
}

export type BoardDatabaseClient = ReturnType<typeof createBoardDatabase>;
const freeStorage = "meldrift-free";
const freeDatabase = createBoardDatabase(freeStorage, defaultBoard);
export function loadBoardState(readOnly = false) {
    if (!readOnly) {
        return freeDatabase.load();
    }
    const reader = createBoardDatabase(freeStorage, defaultBoard);
    return reader.load({ readOnly: true }).finally(reader.close);
}
export const closeBoardState = freeDatabase.closeWhenIdle;
export const replaceBoardState = (snapshot: BoardSnapshot) => freeDatabase.replace(snapshot);
export const encodeBoardDatabase = freeDatabase.encode;
export const decodeBoardDatabase = (bytes: ArrayBuffer) => freeDatabase.decode(bytes, defaultBoard.boardId);

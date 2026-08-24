import type { BoardSnapshot } from "@/lib/board-state";
import type { BrowserDbPayload, BrowserDbRequest, BrowserDbResponse } from "@/lib/browser-db/protocol";

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let nextRequestId = 1;
let resetInProgress = false;
const pendingRequests = new Map<number, PendingRequest>();

function rejectAll(error: Error) {
    pendingRequests.forEach(({ reject }) => reject(error));
    pendingRequests.clear();
}

function getWorker() {
    if (typeof window === "undefined") {
        throw new Error("Browser SQLite is only available in a browser.");
    }

    if (!worker) {
        worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        worker.addEventListener("message", (event: MessageEvent<BrowserDbResponse>) => {
            const response = event.data;
            const pending = pendingRequests.get(response.id);
            if (!pending) return;

            pendingRequests.delete(response.id);
            if (response.ok) pending.resolve(response.value);
            else pending.reject(new Error(response.error));
        });
        worker.addEventListener("error", () => {
            rejectAll(new Error("Browser SQLite could not be started."));
            worker?.terminate();
            worker = null;
        });

        void navigator.storage?.persist?.().catch(() => false);
    }

    return worker;
}

function request<T>(payload: BrowserDbPayload, transfer: Transferable[] = []) {
    return new Promise<T>((resolve, reject) => {
        const id = nextRequestId++;
        pendingRequests.set(id, {
            resolve: resolve as (value: unknown) => void,
            reject,
        });
        getWorker().postMessage({ ...payload, id } as BrowserDbRequest, transfer);
    });
}

export const loadBoardState = () => request<BoardSnapshot>({ type: "load" });

export const replaceBoardState = (snapshot: BoardSnapshot) => {
    if (resetInProgress) return Promise.resolve();
    return request<void>({ type: "replace", snapshot });
};

export const exportBoardDatabase = () => request<ArrayBuffer>({ type: "export" });

export const importBoardDatabase = (bytes: ArrayBuffer) =>
    request<BoardSnapshot>({ type: "import", bytes }, [bytes]);

export const resetBoardDatabase = async () => {
    if (resetInProgress) return;
    resetInProgress = true;
    try {
        await request<void>({ type: "reset" });
    } catch (error) {
        resetInProgress = false;
        throw error;
    }
};

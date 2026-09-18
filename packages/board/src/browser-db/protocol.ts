import type { BoardInfo, BoardSnapshot } from "../board-state";

export type SyncMetadata = {
    revision: number;
    generation: number;
    dirty: boolean;
    changedAt: number;
    mutationId?: string;
};
export type StoredBoard = { bytes: ArrayBuffer; sync: SyncMetadata };

export type BrowserDbPayload =
    | { type: "load" }
    | { type: "replace"; snapshot: BoardSnapshot; dirty?: boolean }
    | { type: "export" }
    | { type: "import"; bytes: ArrayBuffer; revision?: number }
    | { type: "record" }
    | { type: "acknowledge"; generation: number; revision: number }
    | { type: "reset" };

export type BrowserDbRequest = BrowserDbPayload & { id: number; storageName: string; board: BoardInfo };
export type BrowserDbResponse =
    | { id: number; ok: true; value?: BoardSnapshot | ArrayBuffer | StoredBoard }
    | { id: number; ok: false; error: string };

import type { BoardInfo, BoardSnapshot } from "../board-state";
import type { BoardOperation } from "../board-delta";
import type { RemotePatch } from "../remote-patch";

export type SyncMetadata = {
    revision: number;
    generation: number;
    dirty: boolean;
    changedAt: number;
    mutationId?: string;
    seeded?: boolean;
};
export type StoredBoard = { bytes: ArrayBuffer; sync: SyncMetadata };
export type OutboxBatch = { claim: number; mutationId: string; operations: BoardOperation[] };
export type OutboxState = { pending: BoardOperation[]; claimed: OutboxBatch[] };
export type StoredAsset = { data: ArrayBuffer; mimeType: string };
export type TransferredAsset = { assetId: string; data: ArrayBuffer; mimeType: string };
export type RemoteApplied = { seq: number; patch: RemotePatch };

export type BrowserDbPayload =
    | { type: "load"; readOnly?: boolean }
    | { type: "flush" }
    | { type: "replace"; snapshot: BoardSnapshot; dirty?: boolean; remoteSeq?: number; deferredKeys?: string[] }
    | { type: "export" }
    | { type: "encode"; snapshot: BoardSnapshot }
    | { type: "decode"; bytes: ArrayBuffer; expectedBoardId?: number }
    | { type: "import"; bytes: ArrayBuffer; revision?: number }
    | { type: "record" }
    | { type: "acknowledge"; generation: number; revision: number }
    | { type: "seed"; snapshot: BoardSnapshot; revision: number }
    | { type: "commitOutbox"; claim: number; generation: number; revision: number | null }
    | { type: "applyRemote"; operations: BoardOperation[]; revision: number; assets: TransferredAsset[] }
    | { type: "advanceRevision"; revision: number }
    | { type: "pendingKeys" }
    | { type: "resetRemoteLog" }
    | { type: "asset"; assetId: string }
    | { type: "outbox" }
    | { type: "claimOutbox"; limit: number }
    | { type: "releaseOutbox"; claim: number }
    | { type: "clearOutbox"; claim: number }
    | { type: "reset" };

export type BrowserDbRequest = BrowserDbPayload & { id: number; storageName: string; board: BoardInfo };
export type BrowserDbResponse =
    | {
        id: number;
        ok: true;
        value?: BoardSnapshot | ArrayBuffer | StoredBoard | OutboxState | OutboxBatch | StoredAsset
            | RemoteApplied | string[] | null;
    }
    | { id: number; ok: false; error: string };

import type { BoardDatabaseClient } from "@meldrift/board-data/browser-db/client";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import type { OutboxBatch } from "@meldrift/board-data/browser-db/protocol";
import {
    changeEnvelopeBytes, maxChangeBytes, maxStagedOperations, stagedChangeMimeType,
} from "@meldrift/board-data/board-delta";
import { remoteSeqOf } from "@meldrift/board-data/remote-patch";
import { AssetUploadError, uploadAsset } from "./asset-upload";
import { snapshotDelayMs } from "./snapshot";
import type { SyncStatus } from "./snapshot-sync";

const retryDelayMs = 10000;

export async function lookupChange(boardEndpoint: string, mutationId: string, signal?: AbortSignal) {
    const response = await fetch(
        `${boardEndpoint}/changes?mutationId=${encodeURIComponent(mutationId)}`,
        { signal, cache: "no-store" },
    );
    if (!response.ok) {
        throw new Error("The board could not be checked for unfinished saves.");
    }
    return await response.json() as { applied: boolean; revision: number | null };
}
const terminalStatuses = [400, 401, 403, 404, 409, 413];
const encoder = new TextEncoder();

const inlineBudget = maxChangeBytes - changeEnvelopeBytes;

// Live 협업일 때만 붙는다. 없으면 기존 단일 편집자 동작과 같다.
export type LiveSyncHooks = {
    clientId: string;
    // 남이 잠갔거나 잠금 응답을 기다리는 키. 이 키의 로컬 변경은 아직 기록하지 않는다.
    deferredKeys: () => string[];
    // 낙관적 잠금 요청이 끝날 때까지 커밋을 미룬다. 거절되면 그 변경은 기록되지 않는다.
    beforeCommit: () => Promise<void>;
    // 판 번호는 RemoteApplier가 빈틈없이 올린다. 여기서는 내 커밋 번호만 알린다.
    onCommitted: (revision: number, mutationId: string) => void;
};

export class ChangeSync {
    private timer: ReturnType<typeof setTimeout> | undefined;
    private queue = Promise.resolve();
    private committing = false;
    private stopped = false;
    private lastChange = 0;
    private flight: Promise<void> | undefined;
    private controller: AbortController | undefined;
    private urgent = false;
    private pendingSaves = 0;
    private latest: BoardSnapshot | null = null;
    private live: LiveSyncHooks | null = null;

    constructor(
        private database: BoardDatabaseClient,
        private boardEndpoint: string,
        private onStatus: (status: SyncStatus, message?: string) => void,
        private onCommitted: () => void = () => {},
    ) {}

    attachLive(live: LiveSyncHooks) {
        this.live = live;
    }

    save(snapshot: BoardSnapshot) {
        this.latest = snapshot;
        this.pendingSaves += 1;
        this.queue = this.queue.then(async () => {
            await this.database.replace(snapshot, true, this.live ? {
                remoteSeq: remoteSeqOf(snapshot) ?? 0,
                deferredKeys: this.live.deferredKeys(),
            } : {});
            this.lastChange = Date.now();
            if (!this.stopped) {
                this.onStatus("local");
            }
            this.schedule(this.urgent ? 0 : snapshotDelayMs);
        }).catch((error: unknown) => {
            this.onStatus("error", error instanceof Error ? error.message : "Local save failed.");
        }).finally(() => {
            this.pendingSaves -= 1;
        });
        return this.queue;
    }

    // 잠금을 얻어 미뤄 둔 변경을 기록할 수 있게 되면, 마지막 화면 상태를 다시 저장한다.
    resave() {
        if (this.latest && !this.stopped) {
            void this.save(this.latest);
        }
    }

    // 잠금을 풀기 전에 3초 디바운스를 건너뛰고 바로 보낸다.
    flushNow() {
        if (this.stopped) {
            return;
        }
        this.urgent = true;
        if (!this.committing) {
            this.schedule(0);
        }
    }

    idle() {
        return !this.committing && this.pendingSaves === 0;
    }

    resume(changedAt: number) {
        this.lastChange = changedAt;
        this.onStatus("local");
        this.schedule(Math.max(0, changedAt + snapshotDelayMs - Date.now()));
    }

    private schedule(delay: number) {
        clearTimeout(this.timer);
        if (!this.stopped) {
            this.timer = setTimeout(() => {
                if (!this.committing) {
                    this.flight = this.commit();
                }
            }, delay);
        }
    }

    private async uploadAssets(batch: OutboxBatch) {
        for (const operation of batch.operations) {
            if (!operation.asset || this.stopped) {
                continue;
            }
            const assetId = String(operation.changes.assetId ?? "");
            const asset = assetId ? await this.database.asset(assetId) : null;
            if (!asset) {
                throw new Error("The image bytes are missing from local storage.");
            }
            await uploadAsset({
                boardEndpoint: this.boardEndpoint, assetId,
                data: asset.data, mimeType: asset.mimeType, signal: this.controller?.signal,
            });
        }
    }

    private async nextBatch(): Promise<OutboxBatch | undefined> {
        const outbox = await this.database.outbox();
        if (outbox.claimed.length > 0) {
            return outbox.claimed[0];
        }
        if (outbox.pending.length === 0) {
            return undefined;
        }

        const record = await this.database.record();
        const remaining = record.sync.changedAt + snapshotDelayMs - Date.now();
        if (remaining > 0 && !this.urgent) {
            this.schedule(remaining);
            return undefined;
        }
        this.urgent = false;
        return this.database.claimOutbox(Math.min(outbox.pending.length, maxStagedOperations));
    }

    private async stage(mutationId: string, encoded: Uint8Array) {
        await uploadAsset({
            boardEndpoint: this.boardEndpoint, assetId: mutationId,
            data: encoded.buffer.slice(
                encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer,
            mimeType: stagedChangeMimeType, signal: this.controller?.signal,
        });
    }

    private async commit() {
        if (this.stopped || this.committing) {
            return;
        }
        this.committing = true;
        let retry = false;
        try {
            await this.queue;
            if (this.live) {
                await this.live.beforeCommit();
                await this.queue;
            }
            const record = await this.database.record();
            const batch = await this.nextBatch();
            if (!batch || batch.operations.length === 0 || this.stopped) {
                if (batch) {
                    await this.database.clearOutbox(batch.claim);
                }
                return;
            }

            this.onStatus("saving");
            this.controller = new AbortController();
            await this.uploadAssets(batch);

            const encoded = encoder.encode(JSON.stringify(batch.operations));
            const staged = encoded.byteLength > inlineBudget;
            if (staged) {
                await this.stage(batch.mutationId, encoded);
            }

            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (this.live) {
                headers["X-Meldrift-Client"] = this.live.clientId;
            }
            const response = await fetch(`${this.boardEndpoint}/changes`, {
                method: "POST",
                headers,
                body: JSON.stringify(staged
                    ? { baseRevision: record.sync.revision, mutationId: batch.mutationId, staged: true }
                    : {
                        baseRevision: record.sync.revision,
                        mutationId: batch.mutationId,
                        operations: batch.operations,
                    }),
                signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(60000)]),
            });
            const data = await response.json();

            if (!response.ok) {
                if (terminalStatuses.includes(response.status)) {
                    this.stop();
                    this.onStatus("blocked", data.message ?? "Editing authorization changed.");
                    return;
                }
                throw new Error(data.message ?? "Server save failed.");
            }

            await this.database.commitOutbox(batch.claim, record.sync.generation, this.live ? null : data.revision);
            this.live?.onCommitted(Number(data.revision), batch.mutationId);
            const outbox = await this.database.outbox();
            const pending = outbox.pending.length > 0;
            this.onStatus(pending ? "local" : "saved");
            this.onCommitted();
            if (pending) {
                this.schedule(0);
            }
        } catch (error) {
            if (error instanceof AssetUploadError && terminalStatuses.includes(error.status)) {
                this.stop();
                this.onStatus("blocked", error.message);
                return;
            }
            if (!this.stopped) {
                this.onStatus("error", error instanceof Error ? error.message : "Server save failed.");
            }
            retry = true;
        } finally {
            this.committing = false;
            if (retry) {
                this.schedule(retryDelayMs);
            }
        }
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        this.controller?.abort();
    }

    async settled() {
        await this.queue;
        await this.flight;
    }

    async pause() {
        this.stop();
        await this.settled();
    }

    async close() {
        await this.pause();
        this.database.close();
    }
}

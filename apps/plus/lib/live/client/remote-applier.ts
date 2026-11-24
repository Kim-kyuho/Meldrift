import type { BoardDatabaseClient } from "@meldrift/board-data/browser-db/client";
import type { RemoteApplied, TransferredAsset } from "@meldrift/board-data/browser-db/protocol";
import type { BoardOperation } from "@meldrift/board-data/board-delta";
import { downloadAsset } from "@/lib/asset-download";
import type { LiveCommit } from "../protocol";

type Entry = { own: true } | { own: false; commit: LiveCommit };

type ApplierOptions = {
    database: BoardDatabaseClient;
    boardEndpoint: string;
    clientId: string;
    initialRevision: number;
    onBatch: (applied: RemoteApplied) => void;
    onResync: (message: string) => void;
};

export class ResyncRequired extends Error {}

type ChangeLogResponse = {
    ok: boolean;
    head: number;
    more: boolean;
    mutations: LiveCommit[];
};

export async function fetchChangeLog(boardEndpoint: string, after: number, signal?: AbortSignal) {
    const response = await fetch(`${boardEndpoint}/changes?after=${after}&limit=200`, { cache: "no-store", signal });
    if (response.status === 410) {
        throw new ResyncRequired("Older changes are no longer kept on the server.");
    }
    if (!response.ok) {
        throw new Error("Shared changes could not be loaded.");
    }
    return await response.json() as ChangeLogResponse;
}

// 새 이미지 바이트는 워커에 넘기기 전에 받아 둔다. 로컬에 이미 있으면 다시 받지 않는다.
export async function collectRemoteAssets(
    database: BoardDatabaseClient, boardEndpoint: string, operations: BoardOperation[], signal?: AbortSignal,
) {
    const assets: TransferredAsset[] = [];
    const seen = new Set<string>();
    for (const operation of operations) {
        const assetId = operation.type === "image" ? String(operation.changes.assetId ?? "") : "";
        if (!assetId || seen.has(assetId)) {
            continue;
        }
        seen.add(assetId);
        const cached = await database.asset(assetId);
        if (cached) {
            assets.push({ assetId, data: cached.data, mimeType: cached.mimeType });
            continue;
        }
        const downloaded = await downloadAsset(boardEndpoint, assetId, signal);
        const data = downloaded.data.buffer.slice(
            downloaded.data.byteOffset, downloaded.data.byteOffset + downloaded.data.byteLength) as ArrayBuffer;
        assets.push({ assetId, data, mimeType: downloaded.mimeType });
    }
    return assets;
}

// 서버 판 번호를 빈틈없이 따라간다. 연속된 다음 판만 적용하고, 빈 판이 1초 넘게 채워지지 않으면 변경 로그에서 가져온다.
export class RemoteApplier {
    private watermark: number;
    private head = 0;
    private buffer = new Map<number, Entry>();
    private ownMutations = new Set<string>();
    private chain = Promise.resolve();
    private gapTimer: ReturnType<typeof setTimeout> | undefined;
    private filling = false;
    private stopped = false;
    private watchers = new Set<() => void>();

    constructor(private options: ApplierOptions) {
        this.watermark = options.initialRevision;
    }

    get revision() {
        return this.watermark;
    }

    // 잠금을 얻은 키의 직전 확정 변경까지 받았는지 기다릴 때 쓴다.
    async waitFor(revision: number, timeoutMs: number) {
        if (this.watermark >= revision) {
            return true;
        }
        this.noteHead(revision);
        return new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
                this.watchers.delete(check);
                resolve(this.watermark >= revision);
            }, timeoutMs);
            const check = () => {
                if (this.watermark >= revision) {
                    clearTimeout(timer);
                    this.watchers.delete(check);
                    resolve(true);
                }
            };
            this.watchers.add(check);
        });
    }

    // Live 규칙으로 바꾸기 전(첫 연결 전)에 기존 방식으로 커밋된 판이 있으면 기준값을 그만큼 올린다.
    syncWatermark(revision: number) {
        if (revision <= this.watermark) {
            return;
        }
        this.watermark = revision;
        for (const pending of [...this.buffer.keys()]) {
            if (pending <= revision) {
                this.buffer.delete(pending);
            }
        }
        this.watchers.forEach((watcher) => watcher());
    }

    noteOwnCommit(revision: number, mutationId: string) {
        this.ownMutations.add(mutationId);
        if (revision > this.watermark) {
            this.buffer.set(revision, { own: true });
        }
        this.noteHead(revision);
        this.drain();
    }

    noteHead(head: number) {
        if (head > this.head) {
            this.head = head;
        }
        if (this.head > this.watermark) {
            this.scheduleGapFill(this.buffer.has(this.watermark + 1) ? 1000 : 300);
        }
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.gapTimer);
        this.watchers.clear();
    }

    private drain() {
        this.chain = this.chain.then(async () => {
            while (!this.stopped && this.buffer.has(this.watermark + 1)) {
                const revision = this.watermark + 1;
                const entry = this.buffer.get(revision)!;
                this.buffer.delete(revision);
                await this.apply(revision, entry);
            }
            if (this.head > this.watermark) {
                this.scheduleGapFill(1000);
            }
        }).catch((error: unknown) => {
            this.fail(error);
        });
    }

    private async apply(revision: number, entry: Entry) {
        const { database, boardEndpoint, clientId } = this.options;
        const own = entry.own || this.ownMutations.has(entry.commit.mutationId) || entry.commit.by.clientId === clientId;
        if (own) {
            await database.advanceRevision(revision);
        } else {
            const operations = entry.commit.operations;
            const assets = await collectRemoteAssets(database, boardEndpoint, operations);
            const applied = await database.applyRemote(operations, revision, assets);
            this.options.onBatch(applied);
        }
        this.watermark = revision;
        if (!entry.own) {
            this.ownMutations.delete(entry.commit.mutationId);
        }
        this.watchers.forEach((watcher) => watcher());
    }

    private scheduleGapFill(delay: number) {
        if (this.stopped || this.gapTimer) {
            return;
        }
        this.gapTimer = setTimeout(() => {
            this.gapTimer = undefined;
            this.chain = this.chain.then(() => this.fill()).then(() => this.drain()).catch((error: unknown) => {
                this.fail(error);
            });
        }, delay);
    }

    private async fill() {
        if (this.filling || this.stopped) {
            return;
        }
        this.filling = true;
        try {
            let after = this.watermark;
            for (let page = 0; page < 20; page += 1) {
                const log = await fetchChangeLog(this.options.boardEndpoint, after);
                this.noteHead(log.head);
                for (const mutation of log.mutations) {
                    if (mutation.revision > this.watermark) {
                        const ownCommit = this.ownMutations.has(mutation.mutationId);
                        this.buffer.set(mutation.revision, ownCommit ? { own: true } : { own: false, commit: mutation });
                    }
                    after = Math.max(after, mutation.revision);
                }
                if (!log.more || log.mutations.length === 0) {
                    break;
                }
            }
        } finally {
            this.filling = false;
        }
    }

    private fail(error: unknown) {
        if (this.stopped) {
            return;
        }
        this.stop();
        const message = error instanceof Error ? error.message : "Shared changes could not be applied.";
        this.options.onResync(`${message} Download the local backup or restore the server version.`);
    }
}

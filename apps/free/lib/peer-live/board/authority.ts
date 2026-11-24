import { boardLockKey, memoOrderKey, objectKeyOf, strokeLayerKey, touchedKeysOf, type BoardOperation } from "@meldrift/board-data/board-delta";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { applyRemotePatch, objectKeysOfContent, resolveRemoteOperations, type RemoteAsset } from "@meldrift/board-data/remote-patch";
import { validateShareableBoard, type BoardCommit, type BoardProposal } from "./wire";
import type { RoomRole } from "../signaling/protocol";

export type Intent = "edit" | "move";
export type BoardLock = { key: string; owner: string; intent: Intent };
type Actor = { id: string; role: RoomRole };

export class ProposalError extends Error {}

export function keysForChange(operations: BoardOperation[]) {
    const keys = new Set(touchedKeysOf(operations));
    for (const operation of operations) {
        if (operation.type !== "memo") {
            continue;
        }
        if (operation.action !== "update") {
            keys.add(memoOrderKey);
        }
        if ("sortOrder" in operation.changes && operation.action === "update") {
            keys.add(objectKeyOf("memo", operation.syncId));
        }
    }
    return [...keys];
}

export function requiredLocks(operations: BoardOperation[]) {
    const keys = new Set<string>();
    for (const operation of operations) {
        if (operation.action === "create") {
            if (operation.type === "memo") {
                keys.add(memoOrderKey);
            }
        } else if (operation.type === "stroke") {
            keys.add(strokeLayerKey);
        } else {
            for (const key of keysForChange([operation])) {
                keys.add(key);
            }
        }
    }
    return [...keys];
}

type Receipt = { sequence: number; digest: string };
type Writer = (board: BoardSnapshot) => Promise<void>;

export class BoardAuthority {
    private locks = new Map<string, BoardLock>();
    private latestTouches = new Map<string, number>();
    private writes = Promise.resolve();
    private roomOpen = true;
    revision = 0;

    constructor(
        public board: BoardSnapshot,
        private readonly persist: Writer,
        private readonly announce: (commit: BoardCommit) => void,
    ) {}

    getLocks() {
        return [...this.locks.values()];
    }

    acquire(actor: Actor, keys: string[], intent: Intent) {
        if (!this.roomOpen || actor.role !== "editor") {
            return { granted: false as const, owner: null };
        }
        if (keys.length > 200 || this.locks.size + keys.filter((key) => !this.locks.has(key)).length > 200) {
            return { granted: false as const, owner: null };
        }
        for (const lock of this.locks.values()) {
            if (lock.owner !== actor.id && (keys.includes(lock.key) || keys.includes(boardLockKey) || lock.key === boardLockKey)) {
                return { granted: false as const, owner: lock.owner };
            }
        }
        for (const key of keys) {
            this.locks.set(key, { key, owner: actor.id, intent });
        }
        return { granted: true as const, revision: this.revision };
    }

    release(owner: string, keys?: string[]) {
        for (const [key, lock] of this.locks) {
            if (lock.owner === owner && (!keys || keys.includes(key))) {
                this.locks.delete(key);
            }
        }
    }

    proposalsFrom(actor: Actor, isConnected: () => boolean) {
        // A new connection restarts its proposal sequence, even when it keeps the same seat.
        let receipt: Receipt | undefined;
        return (proposal: BoardProposal) => {
            const task = this.writes.then(async () => {
                receipt = await this.commit(actor, proposal, isConnected, receipt);
            });
            this.writes = task.then(() => {}, () => {});
            return task;
        };
    }

    async end() {
        this.roomOpen = false;
        await this.writes;
    }

    private async commit(actor: Actor, proposal: BoardProposal, isConnected: () => boolean, previous?: Receipt): Promise<Receipt> {
        if (!this.roomOpen || actor.role !== "editor" || !isConnected()) {
            throw new ProposalError("This seat cannot edit.");
        }
        const { change, assets, sequence } = proposal;
        const digest = JSON.stringify(change);
        if (previous && sequence <= previous.sequence) {
            if (previous.sequence === sequence && previous.digest === digest) {
                return previous;
            }
            throw new ProposalError("This change was already processed.");
        }
        const keys = keysForChange(change.operations);
        if (change.baseRevision > this.revision || change.baseRevision < this.revision - 256
            || keys.some((key) => (this.latestTouches.get(key) ?? 0) > change.baseRevision)) {
            throw new ProposalError("The board changed while you were editing. Try again with the latest version.");
        }
        if (requiredLocks(change.operations).some((key) => this.locks.get(key)?.owner !== actor.id)) {
            throw new ProposalError("A required edit lock was lost. Your changes were not saved.");
        }

        const objects = new Set(objectKeysOfContent(this.board));
        for (const { type, syncId, action } of change.operations) {
            if (objects.has(objectKeyOf(type, syncId)) === (action === "create")) {
                throw new ProposalError("A card was already created or removed.");
            }
        }
        this.checkAssets(change.operations, assets);
        const patch = resolveRemoteOperations(this.board, change.operations, assets);
        const next = validateShareableBoard(applyRemotePatch(this.board, patch));
        await this.persist(next);

        this.board = next;
        const revision = ++this.revision;
        for (const key of keys) {
            this.latestTouches.set(key, revision);
        }
        for (const [key, last] of this.latestTouches) {
            if (last < revision - 256) {
                this.latestTouches.delete(key);
            }
        }
        this.announce({ kind: "commit", revision, author: actor.id, change, assets });
        return { sequence, digest };
    }

    private checkAssets(operations: BoardOperation[], assets: ReadonlyMap<string, RemoteAsset>) {
        const exposed = new Set<string>();
        for (const operation of operations) {
            if (operation.type !== "image" || operation.action === "delete") {
                continue;
            }
            if (operation.changes.url) {
                throw new ProposalError("Shared image cards must use local image files.");
            }
            const id = operation.changes.assetId;
            if (typeof id === "string" && id) {
                exposed.add(id);
            }
        }
        for (const id of assets.keys()) {
            if (!exposed.has(id) || this.board.images.some((image) => image.assetId === id)) {
                throw new ProposalError("This image asset cannot be replaced in place.");
            }
        }
    }
}

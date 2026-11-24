import { diffBoardSnapshots } from "@meldrift/board-data/board-delta";
import { parseChangeRequest } from "@meldrift/board-data/change-request";
import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { applyRemotePatch, emptyRemotePatch, remoteSeqOf, resolveRemoteOperations, type RemotePatch } from "@meldrift/board-data/remote-patch";
import { sanitizeSharedChange } from "./memo-content";
import { changeAssets, type BoardCommit } from "./wire";

type RevisionPatch = { seq: number; patch: RemotePatch };

export class BoardReplica {
    private patches: RevisionPatch[] = [];
    private sequence = 0;
    board: BoardSnapshot | null = null;
    revision = 0;

    constructor(private readonly clientId: string) {}

    install(board: BoardSnapshot, revision: number) {
        this.board = board;
        this.revision = revision;
        this.patches = [];
        this.sequence = 0;
    }

    accept(commit: BoardCommit): RevisionPatch | null {
        if (commit.revision <= this.revision) {
            return null;
        }
        if (!this.board || commit.revision !== this.revision + 1) {
            throw new Error("The shared board must reconnect to the host.");
        }

        const patch = resolveRemoteOperations(this.board, commit.change.operations, commit.assets);
        this.board = applyRemotePatch(this.board, patch);
        this.revision = commit.revision;
        // The author already has the edit on screen, including its local undo entry.
        const entry = { seq: ++this.sequence, patch: commit.author === this.clientId ? emptyRemotePatch() : patch };
        this.patches.push(entry);
        if (this.patches.length > 128) {
            this.patches.shift();
        }
        return entry;
    }

    prepare(snapshot: BoardSnapshot) {
        if (!this.board) {
            return null;
        }
        const seen = remoteSeqOf(snapshot) ?? 0;
        if (seen < (this.patches[0]?.seq ?? 1) - 1) {
            throw new Error("Too many changes arrived. Editing has caught up with the host.");
        }
        let latest = snapshot;
        for (const entry of this.patches) {
            if (entry.seq > seen) {
                latest = applyRemotePatch(latest, entry.patch);
            }
        }
        // Diff by sync ID. Two tabs may temporarily assign the same display ID to separate new cards.
        const operations = diffBoardSnapshots(this.board, {
            ...latest, mermaids: latest.mermaids.map((card) => ({ ...card, source: card.source.trim() })),
        });
        if (operations.length === 0) {
            return null;
        }
        const change = sanitizeSharedChange(parseChangeRequest({ baseRevision: this.revision, mutationId: crypto.randomUUID(), operations }));
        return { change, assets: changeAssets(latest, change) };
    }

}

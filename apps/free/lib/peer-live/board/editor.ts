import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import type { BoardCollaboration, CollaborationLock, CollaborationStatus, LockDenial, RemoteBatch } from "@meldrift/ui/collaboration";
import type { LockOutcome, Peer, PresenceFrame } from "../protocol";
import { requiredLocks, type BoardLock, type Intent } from "./authority";
import { BoardReplica } from "./replica";
import type { BoardCommit, BoardProposal } from "./wire";

type EditorTransport = {
    acquire: (keys: string[], intent: Intent) => Promise<LockOutcome>;
    release: (keys: string[]) => void;
    propose: (operation: BoardProposal) => Promise<void>;
    presence: (frame: PresenceFrame) => void;
};

type EditorView = {
    collaboration: BoardCollaboration;
    initialBoard: BoardSnapshot | null;
    draft: BoardSnapshot | null;
    viewKey: number;
};

const releaseDelayMs = 750;

export class PeerEditor {
    readonly replica: BoardReplica;
    private view: EditorView;
    private listeners = new Set<() => void>();
    private patchListeners = new Set<(batch: RemoteBatch) => void>();
    private denialListeners = new Set<(denial: LockDenial) => void>();
    private remoteQueue: RemoteBatch[] = [];
    private peers: Peer[] = [];
    private locks: BoardLock[] = [];
    private presence = new Map<string, PresenceFrame>();
    private desired: ReadonlyMap<string, Intent> = new Map();
    private pressed = new Map<string, number>();
    private releasing = new Set<string>();
    private generation = 0;
    private proposalSequence = 0;
    private pendingSaves = 0;
    private pendingAcquires = 0;
    private saves = Promise.resolve();
    private localFrame: PresenceFrame = { sequence: 0, cursor: null, transients: [] };
    private presenceTimer: ReturnType<typeof setTimeout> | undefined;
    private releaseTimer: ReturnType<typeof setInterval> | undefined;
    private disposed = false;

    constructor(readonly clientId: string, private readonly transport: EditorTransport) {
        this.replica = new BoardReplica(clientId);
        this.view = { collaboration: this.collaboration("connecting", ""), initialBoard: null, draft: null, viewKey: 0 };
        this.releaseTimer = setInterval(this.releaseUnused, 250);
    }

    getSnapshot = () => this.view;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    install(board: BoardSnapshot, revision: number) {
        this.generation += 1;
        this.replica.install(board, revision);
        this.desired = new Map();
        this.pressed.clear();
        this.releasing.clear();
        this.remoteQueue = [];
        this.emit({ initialBoard: board, viewKey: this.view.viewKey + 1 });
    }

    setStatus(status: CollaborationStatus, message = "") {
        if (status !== "open") {
            this.generation += 1;
        }
        this.emit({}, status, message);
    }

    setState(peers: Peer[], locks: BoardLock[]) {
        this.peers = peers;
        this.locks = locks;
        for (const id of this.presence.keys()) {
            if (!peers.some((peer) => peer.id === id)) {
                this.presence.delete(id);
            }
        }
        for (const key of this.releasing) {
            if (!locks.some((lock) => lock.key === key && lock.owner === this.clientId)) {
                this.releasing.delete(key);
            }
        }
        this.emit();
    }

    receivePresence(id: string, frame: PresenceFrame) {
        if (id === this.clientId || frame.sequence <= (this.presence.get(id)?.sequence ?? -1)) {
            return;
        }
        this.presence.set(id, frame);
        this.emit();
    }

    accept(commit: BoardCommit) {
        const entry = this.replica.accept(commit);
        if (!entry) {
            return;
        }
        const batch = { ...entry, preserveLocalIds: true };
        if (this.patchListeners.size > 0) {
            this.patchListeners.forEach((listener) => listener(batch));
        } else {
            this.remoteQueue.push(batch);
        }
    }

    save = (snapshot: BoardSnapshot) => {
        const generation = this.generation;
        this.pendingSaves += 1;
        const task = this.saves.then(async () => {
            if (generation !== this.generation || !this.view.collaboration.canEdit) {
                this.emit({ draft: snapshot });
                return;
            }
            await this.saveChange(snapshot);
        }).finally(() => {
            this.pendingSaves -= 1;
        });
        this.saves = task.catch(() => {});
        return task;
    };

    idle() {
        return this.saves;
    }

    dispose() {
        this.disposed = true;
        clearInterval(this.releaseTimer);
        clearTimeout(this.presenceTimer);
    }

    private async saveChange(snapshot: BoardSnapshot) {
        try {
            const payload = this.replica.prepare(snapshot);
            if (!payload) {
                return;
            }
            const keys = requiredLocks(payload.change.operations);
            const denial = await this.acquire(keys, "edit");
            if (denial) {
                throw new Error(denial.displayName ? `${denial.displayName} is editing this.` : "An edit lock is unavailable.");
            }
            await this.transport.propose({ kind: "propose", sequence: ++this.proposalSequence, ...payload });
        } catch (error) {
            if (this.replica.board) {
                this.install({ ...this.replica.board }, this.replica.revision);
            }
            this.emit({ draft: snapshot });
            throw error;
        }
    }

    private acquire = async (keys: string[], intent: Intent): Promise<LockDenial | null> => {
        const generation = this.generation;
        if (keys.length === 0) {
            return null;
        }
        if (!this.view.collaboration.canEdit) {
            return { keys, email: null, offline: true };
        }
        this.pendingAcquires += 1;
        try {
            const outcome = await this.transport.acquire(keys, intent);
            if (!outcome.granted) {
                return { keys, email: null, displayName: this.peers.find(({ id }) => id === outcome.owner)?.name, offline: outcome.owner === null };
            }
            const expiresAt = Date.now() + 5_000;
            while (this.replica.revision < outcome.revision && Date.now() < expiresAt && generation === this.generation) {
                await new Promise<void>((resolve) => setTimeout(resolve, 30));
            }
            if (generation !== this.generation || this.replica.revision < outcome.revision) {
                return { keys, email: null, offline: true };
            }
            for (const key of keys) {
                this.releasing.delete(key);
                this.pressed.set(key, Date.now() + releaseDelayMs);
            }
            return null;
        } catch {
            return { keys, email: null, offline: true };
        } finally {
            this.pendingAcquires -= 1;
        }
    };

    private syncDesired = (desired: ReadonlyMap<string, Intent>) => {
        const previous = this.desired;
        this.desired = desired;
        for (const [key, intent] of desired) {
            if (previous.get(key) === intent) {
                continue;
            }
            void this.acquire([key], intent).then((denial) => {
                if (denial) {
                    this.denialListeners.forEach((listener) => listener(denial));
                }
            });
        }
        for (const key of previous.keys()) {
            if (!desired.has(key)) {
                this.pressed.set(key, Date.now() + releaseDelayMs);
            }
        }
    };

    private releaseUnused = () => {
        if (this.pendingSaves > 0 || this.pendingAcquires > 0 || this.view.collaboration.status !== "open") {
            return;
        }
        const now = Date.now();
        const unused = this.locks.filter(({ key, owner }) => owner === this.clientId && !this.desired.has(key)
            && !this.releasing.has(key) && (this.pressed.get(key) ?? 0) <= now);
        if (unused.length === 0) {
            return;
        }
        const keys = unused.map(({ key }) => key);
        for (const key of keys) {
            this.releasing.add(key);
            this.pressed.delete(key);
        }
        this.transport.release(keys);
    };

    private onDenied = (listener: (denial: LockDenial) => void) => {
        this.denialListeners.add(listener);
        return () => {
            this.denialListeners.delete(listener);
        };
    };

    private onRemote = (listener: (batch: RemoteBatch) => void) => {
        this.patchListeners.add(listener);
        queueMicrotask(() => {
            if (!this.patchListeners.has(listener)) {
                return;
            }
            const queued = this.remoteQueue;
            this.remoteQueue = [];
            queued.forEach(listener);
        });
        return () => {
            this.patchListeners.delete(listener);
        };
    };

    private publishCursor = (point: PresenceFrame["cursor"]) => {
        this.localFrame.cursor = point;
        this.schedulePresence();
    };

    private publishTransients = (items: PresenceFrame["transients"]) => {
        this.localFrame.transients = items.slice(0, 50);
        this.schedulePresence();
    };

    private schedulePresence() {
        if (this.presenceTimer || this.view.collaboration.status !== "open") {
            return;
        }
        this.presenceTimer = setTimeout(() => {
            this.presenceTimer = undefined;
            if (this.view.collaboration.status === "open") {
                this.transport.presence({ ...this.localFrame, sequence: ++this.localFrame.sequence });
            }
        }, 67);
    }

    private collaboration(status: CollaborationStatus, lastError: string): BoardCollaboration {
        const byId = new Map(this.peers.map((peer) => [peer.id, peer]));
        const foreignLocks = new Map<string, CollaborationLock>();
        const heldKeys = new Set<string>();
        for (const lock of this.locks) {
            if (lock.owner === this.clientId) {
                heldKeys.add(lock.key);
            } else {
                const peer = byId.get(lock.owner);
                if (peer) {
                    foreignLocks.set(lock.key, {
                        key: lock.key, clientId: lock.owner, email: null, displayName: peer.name, intent: lock.intent, color: peer.color, saving: false,
                    });
                }
            }
        }
        const cursors: BoardCollaboration["cursors"] = [];
        const transients: BoardCollaboration["transients"] = [];
        for (const [id, frame] of this.presence) {
            const peer = byId.get(id);
            if (!peer) {
                continue;
            }
            const identity = { clientId: id, email: null, displayName: peer.name, color: peer.color };
            if (frame.cursor) {
                cursors.push({ ...identity, ...frame.cursor });
            }
            for (const item of frame.transients) {
                if (foreignLocks.get(item.key)?.clientId === id) {
                    transients.push({ ...identity, ...item });
                }
            }
        }
        return {
            status, lastError, selfClientId: this.clientId, canEdit: status === "open" && byId.get(this.clientId)?.role === "editor",
            peers: this.peers.map((peer) => ({
                clientId: peer.id, userId: null, email: null, displayName: peer.name,
                color: peer.color, role: peer.role, self: peer.id === this.clientId,
            })),
            heldKeys, foreignLocks, cursors, transients, acquire: this.acquire, syncDesired: this.syncDesired,
            onDenied: this.onDenied, subscribeRemote: this.onRemote, publishCursor: this.publishCursor, publishTransients: this.publishTransients,
        };
    }

    private emit(update: Partial<EditorView> = {}, status = this.view.collaboration.status, message = this.view.collaboration.lastError) {
        this.view = { ...this.view, ...update, collaboration: this.collaboration(status, message) };
        if (!this.disposed) {
            this.listeners.forEach((listener) => listener());
        }
    }
}

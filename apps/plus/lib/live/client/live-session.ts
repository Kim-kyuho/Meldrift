import { directCollaborationSupported } from "@meldrift/core/direct-webrtc";
import { liveLimits, type LiveLock, type LivePeer, type LiveTransient, type LiveTransientInput, type LockIntent } from "../protocol";
import { PeerRoomClient } from "../p2p/room-client";
import type { PeerEvent, RoomStatus } from "../p2p/protocol";

export type LiveStatus = "connecting" | "open" | "reconnecting" | "unavailable" | "idle" | "offline";

export type LiveState = {
    status: LiveStatus;
    canEdit: boolean;
    clientId: string;
    peers: ReadonlyMap<string, LivePeer>;
    locks: ReadonlyMap<string, LiveLock>;
    cursors: ReadonlyMap<string, { x: number; y: number }>;
    transients: ReadonlyMap<string, LiveTransient>;
    offlineReason: string;
    lastError: string;
};

export type AcquireOutcome = { granted: true; keyRevision: number } | { granted: false; conflict: LiveLock | null };

type SessionOptions = {
    boardEndpoint: string;
    clientId: string;
    heldKeys: () => string[];
    onWelcome: (head: number) => void;
    onHead: (head: number) => void;
    onLockLost: (keys: string[]) => void;
};

export const liveFallbackMs = 15_000;
const denied: AcquireOutcome = { granted: false, conflict: null };

const emptyPresence = () => ({ peers: new Map(), locks: new Map(), cursors: new Map(), transients: new Map() });

export class LiveSession {
    private state: LiveState;
    private readonly listeners = new Set<() => void>();
    private readonly transientExpiry = new Map<string, ReturnType<typeof setTimeout>>();
    private room: PeerRoomClient | null = null;
    private epoch: string | null = null;
    private stopped = false;
    private fallback: ReturnType<typeof setTimeout> | undefined;
    private frameTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingCursor: { x: number; y: number } | null | undefined;
    private pendingTransients = new Map<string, LiveTransientInput>();

    constructor(private options: SessionOptions) {
        this.state = {
            status: "connecting", canEdit: false, clientId: options.clientId,
            ...emptyPresence(), offlineReason: "", lastError: "",
        };
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getState = () => this.state;

    start() {
        if (this.stopped || this.room) {
            return;
        }
        if (!directCollaborationSupported()) {
            this.update({ status: "unavailable", lastError: "Open this board over HTTPS in a browser with WebRTC support." });
            return;
        }
        this.update({ status: "connecting", lastError: "" });
        this.armFallback();
        this.room = new PeerRoomClient(this.options.boardEndpoint, this.options.clientId, {
            holding: () => this.options.heldKeys().length > 0,
            status: (room, ready) => this.accept(room, ready),
            received: (clientId, event) => this.receive(clientId, event),
            error: (reason, permanent) => this.fail(reason, permanent),
        });
        this.room.wake();
    }

    stop() {
        this.stopped = true;
        this.disconnect();
    }

    pause() {
        if (this.stopped || this.state.status === "idle" || this.state.status === "offline") {
            return;
        }
        this.disconnect();
        const held = this.options.heldKeys();
        if (held.length > 0) {
            this.options.onLockLost(held);
        }
        this.update({ status: "idle", ...emptyPresence(), lastError: "" });
    }

    resume() {
        if (this.state.status === "idle") {
            this.start();
        }
    }

    reconnectNow() {
        if (this.state.status !== "open") {
            this.room?.wake();
        }
    }

    async acquire(keys: string[], intent: LockIntent): Promise<AcquireOutcome> {
        const room = this.room;
        if (!room || this.state.status !== "open" || !this.state.canEdit) {
            return denied;
        }
        if (keys.length === 0) {
            return { granted: true, keyRevision: 0 };
        }
        try {
            const reply = await room.acquire(keys, intent);
            return this.room === room && this.state.status === "open" ? reply : denied;
        } catch {
            return denied;
        }
    }

    async release(keys: string[]) {
        const room = this.room;
        if (room) {
            for (let index = 0; index < keys.length; index += liveLimits.keysPerRequest) {
                await room.release(keys.slice(index, index + liveLimits.keysPerRequest));
            }
        }
    }

    notifyCommit() {
        this.room?.send({ kind: "refresh" });
    }

    publishCursor(point: { x: number; y: number } | null) {
        this.pendingCursor = point;
        this.scheduleFrame();
    }

    publishTransients(items: LiveTransientInput[]) {
        items.forEach((item) => this.pendingTransients.set(item.key, item));
        this.scheduleFrame();
    }

    private update(patch: Partial<LiveState>) {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach((listener) => listener());
    }

    private disconnect() {
        this.room?.stop();
        this.room = null;
        this.epoch = null;
        clearTimeout(this.fallback);
        this.fallback = undefined;
        clearTimeout(this.frameTimer);
        this.frameTimer = undefined;
        this.pendingCursor = undefined;
        this.pendingTransients.clear();
        this.clearExpiry();
    }

    private clearExpiry() {
        this.transientExpiry.forEach((timer) => clearTimeout(timer));
        this.transientExpiry.clear();
    }

    private armFallback() {
        this.fallback ??= setTimeout(() => {
            this.fallback = undefined;
            if (!this.stopped && this.state.status !== "open" && this.state.status !== "idle") {
                this.clearExpiry();
                this.update({ status: "unavailable", ...emptyPresence(),
                    lastError: this.state.lastError || "Could not establish a direct Live connection. Reconnecting…" });
            }
        }, liveFallbackMs);
    }

    private fail(reason: string, permanent: boolean) {
        if (permanent) {
            this.stop();
            this.update({ status: "offline", ...emptyPresence(), offlineReason: reason, lastError: reason });
        } else {
            this.update({ status: this.state.status === "unavailable" ? "unavailable" : "reconnecting", lastError: reason });
            this.armFallback();
        }
    }

    private accept(room: RoomStatus, connected: boolean) {
        const wasOpen = this.state.status === "open";
        const sameEpoch = this.epoch === room.epoch;
        this.epoch = room.epoch;
        if (!connected) {
            this.clearExpiry();
            this.update({
                status: this.state.status === "unavailable" ? "unavailable" : wasOpen ? "reconnecting" : this.state.status,
                canEdit: room.self.role === "editor", ...emptyPresence(),
                lastError: room.hostId ? "Opening a direct Live connection…" : "Waiting for an editor to join Live.",
            });
            this.armFallback();
            return;
        }

        clearTimeout(this.fallback);
        this.fallback = undefined;
        const peers = new Map(room.peers.map((peer) => [peer.clientId, peer]));
        const locks = new Map(room.locks.map((lock) => [lock.key, lock]));
        const lost = this.options.heldKeys().filter((key) => (!wasOpen || this.state.locks.get(key)?.clientId === this.options.clientId)
            && locks.get(key)?.clientId !== this.options.clientId);
        if (!sameEpoch) {
            this.clearExpiry();
        }
        const cursors = sameEpoch ? new Map([...this.state.cursors].filter(([id]) => peers.has(id))) : new Map();
        const transients = sameEpoch ? new Map([...this.state.transients].filter(([, item]) => locks.get(item.key)?.clientId === item.clientId)) : new Map();
        this.update({
            status: "open", canEdit: room.self.role === "editor", peers, locks, cursors, transients, offlineReason: "", lastError: "",
        });
        if (lost.length > 0) {
            this.options.onLockLost(lost);
        }
        if (!wasOpen || !sameEpoch) {
            this.options.onWelcome(room.head);
        } else {
            this.options.onHead(room.head);
        }
    }

    private receive(clientId: string, event: PeerEvent) {
        if (this.state.status !== "open" || !this.state.peers.has(clientId)) {
            return;
        }
        if (event.kind === "cursor") {
            const cursors = new Map(this.state.cursors);
            if (event.point) {
                cursors.set(clientId, event.point);
            } else {
                cursors.delete(clientId);
            }
            this.update({ cursors });
        } else if (event.kind === "transient") {
            const transients = new Map(this.state.transients);
            for (const item of event.items) {
                if (this.state.locks.get(item.key)?.clientId !== clientId) {
                    continue;
                }
                const key = `${clientId}|${item.key}`;
                transients.set(key, { ...item, clientId });
                clearTimeout(this.transientExpiry.get(key));
                this.transientExpiry.set(key, setTimeout(() => {
                    this.transientExpiry.delete(key);
                    const current = new Map(this.state.transients);
                    if (current.delete(key)) {
                        this.update({ transients: current });
                    }
                }, 10_000));
            }
            this.update({ transients });
        }
    }

    private scheduleFrame() {
        if (this.state.status !== "open" || this.frameTimer) {
            return;
        }
        this.frameTimer = setTimeout(() => {
            this.frameTimer = undefined;
            const cursor = this.pendingCursor;
            this.pendingCursor = undefined;
            const items = [...this.pendingTransients.values()].slice(0, liveLimits.transientsPerMessage);
            this.pendingTransients.clear();
            if (this.state.status === "open" && cursor !== undefined) {
                this.room?.send({ kind: "cursor", point: cursor });
            }
            if (this.state.status === "open" && items.length > 0) {
                this.room?.send({ kind: "transient", items });
            }
        }, liveLimits.frameMs);
    }
}

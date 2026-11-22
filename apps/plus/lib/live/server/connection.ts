import { randomUUID } from "node:crypto";
import {
    clientMessageSchema, holderOf, liveCloseCodes, liveLimits, maskEmail,
    type BoardEvent, type ClientMessage, type LiveLock, type LivePeer, type LockIntent, type ServerMessage,
} from "../protocol";
import type { PresenceRecord, StoredLock } from "../store/types";
import { resolveLiveIdentity, type LiveIdentity } from "./identity";
import type { LiveSocket } from "./socket";
import type { LiveHub } from "./hub";

class RateWindow {
    private count = 0;
    private windowStart = 0;

    constructor(private perSecond: number) {}

    allow(now: number) {
        if (now - this.windowStart >= 1000) {
            this.windowStart = now;
            this.count = 0;
        }
        this.count += 1;
        return this.count <= this.perSecond;
    }
}

const publicLock = (lock: StoredLock): LiveLock => ({
    key: lock.key,
    holder: lock.holder,
    clientId: lock.clientId,
    userId: lock.userId,
    email: lock.email,
    intent: lock.intent,
    color: lock.color,
});

const publicPeer = (peer: LivePeer): LivePeer => ({
    clientId: peer.clientId,
    userId: peer.userId,
    email: peer.email,
    role: peer.role,
    color: peer.color,
    joinedAt: peer.joinedAt,
});

export class LiveConnection {
    readonly connId = randomUUID();
    private state: "waiting" | "joining" | "open" | "closed" = "waiting";
    private heldKeys = new Set<string>();
    private helloTimer: ReturnType<typeof setTimeout> | undefined;
    private connectedAt: number;
    private lastPong: number;
    private lastPing = 0;
    private lastRevalidated: number;
    private revalidating = false;
    private rotateSent = false;
    private limits = { cursor: new RateWindow(30), transient: new RateWindow(30), lock: new RateWindow(20) };

    constructor(private socket: LiveSocket, public identity: LiveIdentity, private hub: LiveHub) {
        this.connectedAt = hub.now();
        this.lastPong = this.connectedAt;
        this.lastRevalidated = this.connectedAt;
    }

    get boardId() {
        return this.identity.boardId;
    }

    get clientId() {
        return this.identity.clientId;
    }

    get holder() {
        return this.identity.userId === null ? null : holderOf(this.identity.userId, this.identity.clientId);
    }

    get isOpen() {
        return this.state === "open";
    }

    get rotateAt() {
        return this.connectedAt + this.hub.maxDurationMs - liveLimits.rotateLeadMs;
    }

    start() {
        this.helloTimer = setTimeout(() => this.close(liveCloseCodes.badRequest, "Send hello first."), liveLimits.helloTimeoutMs);
        this.socket.onMessage((data) => {
            void this.receive(data).catch((error: unknown) => {
                console.error("live.message_failed", error);
            });
        });
        this.socket.onClose(() => {
            void this.dispose();
        });
    }

    send(message: ServerMessage) {
        if (this.state !== "closed") {
            this.socket.send(JSON.stringify(message));
        }
    }

    close(code: number, reason?: string) {
        this.socket.close(code, reason);
        void this.dispose();
    }

    peerRecord(): PresenceRecord {
        return {
            clientId: this.clientId,
            userId: this.identity.userId,
            email: this.identity.email,
            role: this.identity.role,
            color: this.identity.color,
            joinedAt: this.connectedAt,
            connId: this.connId,
        };
    }

    private lockFor(intent: LockIntent): LiveLock {
        return {
            key: "",
            holder: this.holder ?? "",
            clientId: this.clientId,
            userId: this.identity.userId ?? 0,
            email: this.identity.email,
            intent,
            color: this.identity.color,
        };
    }

    private maskPeer(peer: LivePeer): LivePeer {
        const visible = publicPeer(peer);
        if (this.identity.seesEmails || peer.clientId === this.clientId) {
            return visible;
        }
        return { ...visible, email: maskEmail(peer.email) };
    }

    private maskLock(lock: LiveLock): LiveLock {
        if (this.identity.seesEmails || lock.clientId === this.clientId) {
            return lock;
        }
        return { ...lock, email: maskEmail(lock.email) };
    }

    deliver(event: BoardEvent) {
        if (this.state !== "open") {
            return;
        }
        if (event.t === "frame") {
            const cursors = event.cursors.filter((cursor) => cursor.clientId !== this.clientId);
            const transients = event.transients.filter((item) => item.clientId !== this.clientId);
            if (cursors.length > 0 || transients.length > 0) {
                this.send({ t: "frame", cursors, transients });
            }
            return;
        }
        if (event.t === "presence.join") {
            this.send({ t: "presence.join", peer: this.maskPeer(event.peer) });
            return;
        }
        if (event.t === "lock.acquired") {
            this.send({ t: "lock.acquired", locks: event.locks.map((lock) => this.maskLock(lock)) });
            return;
        }
        if (event.t === "commit") {
            const by = this.identity.seesEmails ? event.by : { ...event.by, email: maskEmail(event.by.email) };
            this.send({ ...event, by });
            return;
        }
        this.send(event);
    }

    private async receive(data: string) {
        if (this.state === "closed") {
            return;
        }
        if (data.length > liveLimits.messageBytes) {
            this.close(1009, "Message too large.");
            return;
        }
        let parsed: ClientMessage;
        try {
            const result = clientMessageSchema.safeParse(JSON.parse(data));
            if (!result.success) {
                this.close(liveCloseCodes.badRequest, "Invalid message.");
                return;
            }
            parsed = result.data;
        } catch {
            this.close(liveCloseCodes.badRequest, "Invalid message.");
            return;
        }

        if (this.state === "waiting") {
            if (parsed.t !== "hello") {
                this.close(liveCloseCodes.badRequest, "Send hello first.");
                return;
            }
            await this.hello(parsed);
            return;
        }
        if (this.state !== "open") {
            return;
        }
        const now = this.hub.now();
        if (parsed.t === "pong") {
            this.lastPong = now;
            return;
        }
        if (parsed.t === "cursor") {
            if (this.identity.role === "guest" || !this.limits.cursor.allow(now)) {
                return;
            }
            if (parsed.hidden || parsed.x === undefined || parsed.y === undefined) {
                this.hub.queueCursor(this.boardId, { clientId: this.clientId, hidden: true });
            } else {
                this.hub.queueCursor(this.boardId, { clientId: this.clientId, x: parsed.x, y: parsed.y });
            }
            return;
        }
        if (parsed.t === "transient") {
            if (!this.limits.transient.allow(now)) {
                return;
            }
            const items = parsed.items.filter((item) => this.heldKeys.has(item.key));
            this.hub.queueTransients(this.boardId, items.map((item) => ({ ...item, clientId: this.clientId })));
            return;
        }
        if (!this.limits.lock.allow(now)) {
            this.close(liveCloseCodes.rateLimited, "Too many lock requests.");
            return;
        }
        if (parsed.t === "lock.acquire") {
            await this.acquire(parsed.reqId, [...new Set(parsed.keys)], parsed.intent);
            return;
        }
        if (parsed.t === "lock.release") {
            await this.release(parsed.keys);
        }
    }

    private async hello(message: Extract<ClientMessage, { t: "hello" }>) {
        if (message.clientId !== this.identity.clientId) {
            this.close(liveCloseCodes.badRequest, "The client id does not match the token.");
            return;
        }
        clearTimeout(this.helloTimer);
        this.state = "joining";
        const store = this.hub.store;
        await this.hub.addConnection(this);
        await this.hub.sweepBoard(this.boardId);

        const record = this.peerRecord();
        if (await store.join(this.boardId, record)) {
            await this.hub.publish(this.boardId, { t: "presence.join", peer: publicPeer(record) });
        }

        let lost: string[] = [];
        if (this.identity.canEdit && this.holder && message.held.length > 0) {
            const lock = this.lockFor("edit");
            const result = await store.reassert(this.boardId, lock, message.held, liveLimits.lockTtlMs);
            result.held.forEach((key) => this.heldKeys.add(key));
            lost = result.lost;
            if (result.held.length > 0) {
                await this.hub.publish(this.boardId, {
                    t: "lock.acquired", locks: result.held.map((key) => ({ ...lock, key })),
                });
            }
        } else {
            lost = message.held;
        }

        const [peers, locks, head] = await Promise.all([
            store.peers(this.boardId),
            store.locks(this.boardId),
            this.hub.headRevision(this.boardId),
        ]);
        if (this.state !== "joining") {
            return;
        }
        this.state = "open";
        this.send({
            t: "welcome",
            connId: this.connId,
            self: this.maskPeer(record),
            peers: peers.map((peer) => this.maskPeer(peer)),
            locks: locks.map((lock) => this.maskLock(publicLock(lock))),
            head,
            rotateAt: this.rotateAt,
            canEdit: this.identity.canEdit,
        });
        if (lost.length > 0) {
            this.send({ t: "lock.lost", keys: lost });
        }
    }

    private async acquire(reqId: number, keys: string[], intent: LockIntent) {
        const store = this.hub.store;
        if (!this.identity.canEdit || !this.holder) {
            this.send({ t: "lock.result", reqId, granted: false, conflict: null });
            return;
        }
        const lock = this.lockFor(intent);
        const result = await store.acquire(this.boardId, lock, keys, liveLimits.lockTtlMs);
        if (!result.granted) {
            const conflict = result.conflict ? this.maskLock(publicLock(result.conflict)) : null;
            this.send({ t: "lock.result", reqId, granted: false, conflict });
            return;
        }
        keys.forEach((key) => this.heldKeys.add(key));
        const keyRevision = await store.keyRevision(this.boardId, keys);
        this.send({ t: "lock.result", reqId, granted: true, keyRevision });
        await this.hub.publish(this.boardId, { t: "lock.acquired", locks: keys.map((key) => ({ ...lock, key })) });
    }

    private async release(keys: string[]) {
        if (!this.holder) {
            return;
        }
        const released = await this.hub.store.release(this.boardId, this.holder, keys);
        released.forEach((key) => this.heldKeys.delete(key));
        keys.forEach((key) => this.heldKeys.delete(key));
        if (released.length > 0) {
            await this.hub.publish(this.boardId, { t: "lock.released", clientId: this.clientId, keys: released });
        }
    }

    // 허브가 5초마다 부른다. ping, pong 시간 초과, 회전 알림, 권한 재검증을 맡는다.
    tick(now: number) {
        if (this.state === "waiting" || this.state === "closed") {
            return;
        }
        if (now - this.lastPong > liveLimits.pongTimeoutMs) {
            this.close(liveCloseCodes.timeout, "No pong.");
            return;
        }
        if (now - this.lastPing >= liveLimits.pingMs) {
            this.lastPing = now;
            this.send({ t: "ping" });
        }
        if (!this.rotateSent && now >= this.rotateAt) {
            this.rotateSent = true;
            this.send({ t: "rotate" });
        }
        if (!this.revalidating && now - this.lastRevalidated >= liveLimits.revalidateMs) {
            this.revalidating = true;
            void this.revalidate(now).finally(() => {
                this.revalidating = false;
            });
        }
    }

    private async revalidate(now: number) {
        const result = await resolveLiveIdentity(this.identity.token);
        this.lastRevalidated = now;
        if (result.closeCode !== null) {
            this.close(result.closeCode, "Access changed.");
            return;
        }
        if (result.identity.canEdit !== this.identity.canEdit || result.identity.seesEmails !== this.identity.seesEmails) {
            this.close(liveCloseCodes.forbidden, "Permissions changed.");
        }
    }

    heldCount() {
        return this.heldKeys.size;
    }

    private async dispose() {
        if (this.state === "closed") {
            return;
        }
        const wasJoined = this.state === "open" || this.state === "joining";
        this.state = "closed";
        clearTimeout(this.helloTimer);
        this.hub.removeConnection(this);
        if (!wasJoined) {
            return;
        }
        try {
            if (await this.hub.store.leave(this.boardId, this.clientId, this.connId)) {
                await this.hub.publish(this.boardId, { t: "presence.leave", clientId: this.clientId });
            }
        } catch (error) {
            console.error("live.leave_failed", error);
        }
    }
}

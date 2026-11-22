import { holderOf, liveLimits, type BoardEvent, type LiveCursor, type LiveTransient } from "../protocol";
import type { LiveStore } from "../store/types";
import { LiveConnection } from "./connection";
import { boardHeadRevision, type LiveIdentity } from "./identity";
import type { LiveSocket } from "./socket";

type Room = {
    connections: Set<LiveConnection>;
    unsubscribe: Promise<() => Promise<void>> | null;
    cursors: Map<string, LiveCursor>;
    transients: Map<string, LiveTransient>;
    frameTimer: ReturnType<typeof setTimeout> | null;
};

type HubOptions = {
    maxDurationMs: number;
    now?: () => number;
    headRevision?: (boardId: number) => Promise<number>;
};

// 함수 인스턴스 하나에 하나. 같은 보드의 소켓을 모아 두고, 다른 인스턴스와는 저장소의 pub/sub로만 이야기한다.
export class LiveHub {
    readonly maxDurationMs: number;
    readonly now: () => number;
    readonly headRevision: (boardId: number) => Promise<number>;
    private rooms = new Map<number, Room>();
    private timers: ReturnType<typeof setInterval>[] = [];

    constructor(readonly store: LiveStore, options: HubOptions) {
        this.maxDurationMs = options.maxDurationMs;
        this.now = options.now ?? Date.now;
        this.headRevision = options.headRevision ?? boardHeadRevision;
    }

    attach(socket: LiveSocket, identity: LiveIdentity) {
        const connection = new LiveConnection(socket, identity, this);
        connection.start();
        return connection;
    }

    async publish(boardId: number, event: BoardEvent) {
        try {
            await this.store.publish(boardId, event);
        } catch (error) {
            console.error("live.publish_failed", error);
        }
    }

    private room(boardId: number) {
        let room = this.rooms.get(boardId);
        if (!room) {
            room = { connections: new Set(), unsubscribe: null, cursors: new Map(), transients: new Map(), frameTimer: null };
            this.rooms.set(boardId, room);
        }
        return room;
    }

    async addConnection(connection: LiveConnection) {
        const room = this.room(connection.boardId);
        room.connections.add(connection);
        if (!room.unsubscribe) {
            room.unsubscribe = this.store.subscribe(connection.boardId, (event) => {
                for (const each of [...room.connections]) {
                    each.deliver(event);
                }
            });
        }
        await room.unsubscribe;
        this.startTimers();
    }

    removeConnection(connection: LiveConnection) {
        const room = this.rooms.get(connection.boardId);
        if (!room || !room.connections.delete(connection)) {
            return;
        }
        if (room.connections.size > 0) {
            return;
        }
        this.rooms.delete(connection.boardId);
        if (room.frameTimer) {
            clearTimeout(room.frameTimer);
        }
        void room.unsubscribe?.then((unsubscribe) => unsubscribe()).catch((error: unknown) => {
            console.error("live.unsubscribe_failed", error);
        });
        if (this.rooms.size === 0) {
            this.stopTimers();
        }
    }

    queueCursor(boardId: number, cursor: LiveCursor) {
        const room = this.rooms.get(boardId);
        if (!room) {
            return;
        }
        room.cursors.set(cursor.clientId, cursor);
        this.scheduleFrame(boardId, room);
    }

    queueTransients(boardId: number, items: LiveTransient[]) {
        const room = this.rooms.get(boardId);
        if (!room || items.length === 0) {
            return;
        }
        for (const item of items) {
            room.transients.set(`${item.clientId}|${item.key}`, item);
        }
        this.scheduleFrame(boardId, room);
    }

    // 커서와 드래그 위치는 50ms에 한 번만 발행한다. 마지막 값만 의미가 있다.
    private scheduleFrame(boardId: number, room: Room) {
        if (room.frameTimer) {
            return;
        }
        room.frameTimer = setTimeout(() => {
            room.frameTimer = null;
            const cursors = [...room.cursors.values()];
            const transients = [...room.transients.values()];
            room.cursors.clear();
            room.transients.clear();
            if (cursors.length > 0 || transients.length > 0) {
                void this.publish(boardId, { t: "frame", cursors, transients });
            }
        }, liveLimits.frameMs);
    }

    async sweepBoard(boardId: number) {
        const removed = await this.store.sweep(boardId, liveLimits.presenceStaleMs);
        for (const peer of removed) {
            await this.publish(boardId, { t: "presence.leave", clientId: peer.clientId });
            if (peer.userId === null) {
                continue;
            }
            const purged = await this.store.purgeHolder(boardId, holderOf(peer.userId, peer.clientId));
            if (purged.length > 0) {
                await this.publish(boardId, { t: "lock.released", clientId: peer.clientId, keys: purged });
            }
        }
    }

    private async heartbeat() {
        for (const [boardId, room] of this.rooms) {
            const open = [...room.connections].filter((connection) => connection.isOpen);
            const holders = open.flatMap((connection) => connection.holder && connection.heldCount() > 0 ? [connection.holder] : []);
            await this.store.touch(boardId, open.map((connection) => connection.clientId));
            await this.store.renew(boardId, holders, liveLimits.lockTtlMs);
        }
    }

    private async sweep() {
        for (const boardId of this.rooms.keys()) {
            await this.sweepBoard(boardId);
        }
    }

    private tick() {
        const now = this.now();
        for (const room of this.rooms.values()) {
            for (const connection of [...room.connections]) {
                connection.tick(now);
            }
        }
    }

    private startTimers() {
        if (this.timers.length > 0) {
            return;
        }
        const guard = (task: () => Promise<void>, name: string) => () => {
            void task().catch((error: unknown) => console.error(`live.${name}_failed`, error));
        };
        this.timers = [
            setInterval(guard(() => this.heartbeat(), "heartbeat"), liveLimits.heartbeatMs),
            setInterval(guard(() => this.sweep(), "sweep"), liveLimits.sweepMs),
            setInterval(() => this.tick(), liveLimits.heartbeatMs),
        ];
    }

    private stopTimers() {
        this.timers.forEach((timer) => clearInterval(timer));
        this.timers = [];
    }

    connectionCount() {
        let count = 0;
        for (const room of this.rooms.values()) {
            count += room.connections.size;
        }
        return count;
    }
}

type HubGlobal = typeof globalThis & { __meldriftLiveHub?: LiveHub };

export function liveMaxDurationMs() {
    const seconds = Number(process.env.LIVE_MAX_DURATION_SECONDS ?? 300);
    return Math.max(60, Number.isFinite(seconds) ? seconds : 300) * 1000;
}

export function getLiveHub(store: LiveStore) {
    const scope = globalThis as HubGlobal;
    scope.__meldriftLiveHub ??= new LiveHub(store, { maxDurationMs: liveMaxDurationMs() });
    return scope.__meldriftLiveHub;
}

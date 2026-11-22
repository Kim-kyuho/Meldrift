import { touchedKeysOf } from "@meldrift/board-data/board-delta";
import {
    liveCloseCodes, liveLimits, liveProtocolVersion,
    type ClientMessage, type LiveCommit, type LiveLock, type LivePeer, type LiveTransient, type LockIntent, type ServerMessage,
} from "../protocol";

// unavailable: 연결이 오래 안 돼 Live 없이 일반 보드처럼 편집하는 상태. 뒤에서는 계속 다시 연결한다.
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
    // 마지막 연결 실패 이유. 연결되면 비운다. 접속자 목록과 콘솔에 보여 준다.
    lastError: string;
};

export type AcquireOutcome = { granted: true; keyRevision: number } | { granted: false; conflict: LiveLock | null };

type SessionOptions = {
    boardId: number;
    boardEndpoint: string;
    clientId: string;
    heldKeys: () => string[];
    revision: () => number;
    onWelcome: (head: number) => void;
    onCommit: (commit: LiveCommit) => void;
    onLockLost: (keys: string[]) => void;
};

type PendingAcquire = { resolve: (outcome: AcquireOutcome) => void; timer: ReturnType<typeof setTimeout> };

const throttleMs = 50;
const welcomeTimeoutMs = 10_000;
export const liveFallbackMs = 10_000;

export function liveSocketBase() {
    const configured = process.env.NEXT_PUBLIC_LIVE_URL;
    if (configured) {
        return configured.replace(/\/$/, "");
    }
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const basePath = window.location.pathname.startsWith("/plus") ? "/plus" : "";
    return `${scheme}://${window.location.host}${basePath}`;
}

// 소켓 하나의 수명과 화면에 보일 공유 상태를 맡는다. 잠금 정책과 원격 반영은 바깥(LiveRuntime)에서 한다.
export class LiveSession {
    private state: LiveState;
    private listeners = new Set<() => void>();
    private socket: WebSocket | null = null;
    private rotating: WebSocket | null = null;
    private stopped = false;
    private paused = false;
    private attempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    private nextRequestId = 1;
    private pending = new Map<number, PendingAcquire>();
    private cursorTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingCursor: { x: number; y: number } | null | undefined;
    private transientTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingTransients = new Map<string, { key: string; x: number; y: number; width: number; height: number }>();
    private transientExpiry = new Map<string, ReturnType<typeof setTimeout>>();
    private welcomeTimer: ReturnType<typeof setTimeout> | undefined;
    private fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private options: SessionOptions) {
        this.state = {
            status: "connecting",
            canEdit: false,
            clientId: options.clientId,
            peers: new Map(),
            locks: new Map(),
            cursors: new Map(),
            transients: new Map(),
            offlineReason: "",
            lastError: "",
        };
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getState = () => this.state;

    private update(patch: Partial<LiveState>) {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach((listener) => listener());
    }

    start() {
        void this.connect(false);
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.reconnectTimer);
        clearTimeout(this.welcomeTimer);
        clearTimeout(this.fallbackTimer);
        clearTimeout(this.cursorTimer);
        clearTimeout(this.transientTimer);
        this.transientExpiry.forEach((timer) => clearTimeout(timer));
        this.pending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ granted: false, conflict: null });
        });
        this.pending.clear();
        this.socket?.close(1000, "Leaving the board.");
        this.rotating?.close(1000, "Leaving the board.");
        this.socket = null;
        this.rotating = null;
    }

    // 오래 입력이 없을 때 연결을 닫는다. 다시 연결할 때는 변경 로그로 놓친 판을 채운다.
    pause() {
        if (this.stopped || this.paused) {
            return;
        }
        this.paused = true;
        clearTimeout(this.reconnectTimer);
        clearTimeout(this.welcomeTimer);
        clearTimeout(this.fallbackTimer);
        this.pending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ granted: false, conflict: null });
        });
        this.pending.clear();
        const sockets = [this.socket, this.rotating];
        this.socket = null;
        this.rotating = null;
        sockets.forEach((socket) => socket?.close(1000, "Idle."));
        this.update({
            status: "idle", peers: new Map(), locks: new Map(), cursors: new Map(), transients: new Map(), lastError: "",
        });
    }

    resume() {
        if (this.stopped || !this.paused) {
            return;
        }
        this.paused = false;
        this.attempt = 0;
        void this.connect(false);
    }

    private goOffline(reason: string) {
        this.stop();
        this.update({ status: "offline", offlineReason: reason, peers: new Map(), locks: new Map(), cursors: new Map(), transients: new Map() });
    }

    // 연결이 끊긴 채 일정 시간이 지나면 Live 없이 편집하도록 넘긴다. 남의 잠금 정보는 더 이상 믿을 수 없으므로 비운다.
    private armFallback() {
        if (this.fallbackTimer) {
            return;
        }
        this.fallbackTimer = setTimeout(() => {
            this.fallbackTimer = undefined;
            const status = this.state.status;
            if (this.stopped || this.paused || status === "open" || status === "offline" || status === "idle") {
                return;
            }
            console.warn("[live] Live collaboration is unavailable; editing continues without locks.");
            this.update({ status: "unavailable", peers: new Map(), locks: new Map(), cursors: new Map(), transients: new Map() });
        }, liveFallbackMs);
    }

    private fail(reason: string) {
        console.warn(`[live] ${reason}`);
        this.update({ lastError: reason });
    }

    private async token() {
        const response = await fetch(`${this.options.boardEndpoint}/live/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: this.options.clientId }),
            cache: "no-store",
        });
        if (response.status === 404) {
            return { token: null, permanent: true, status: response.status };
        }
        if (!response.ok) {
            return { token: null, permanent: response.status === 401 || response.status === 403, status: response.status };
        }
        const data = await response.json() as { token: string };
        return { token: data.token, permanent: false, status: response.status };
    }

    private async connect(rotation: boolean) {
        if (this.stopped || this.paused) {
            return;
        }
        if (!rotation) {
            this.armFallback();
            if (this.state.status !== "unavailable") {
                this.update({ status: this.attempt === 0 ? "connecting" : "reconnecting" });
            }
        }
        let token: string | null;
        try {
            const result = await this.token();
            if (!result.token) {
                if (result.permanent && !rotation) {
                    this.goOffline("Live collaboration is not available for this board.");
                    return;
                }
                throw new Error(`The live token request answered ${result.status}.`);
            }
            token = result.token;
        } catch (error) {
            this.fail(error instanceof Error ? error.message : "The live token request failed.");
            if (!rotation) {
                this.scheduleReconnect();
            }
            return;
        }
        if (this.stopped || this.paused) {
            return;
        }
        const url = `${liveSocketBase()}/api/boards/${this.options.boardId}/live`;
        let socket: WebSocket;
        try {
            socket = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
        } catch (error) {
            // https 페이지에서 ws:// 주소처럼 브라우저가 연결 자체를 막으면 여기서 예외가 난다.
            this.fail(`The browser refused to open ${url}: ${error instanceof Error ? error.message : String(error)}`);
            if (!rotation) {
                this.scheduleReconnect();
            }
            return;
        }
        if (rotation) {
            this.rotating = socket;
        } else {
            this.socket = socket;
            clearTimeout(this.welcomeTimer);
            this.welcomeTimer = setTimeout(() => {
                if (this.socket === socket && this.state.status !== "open") {
                    this.fail(`No answer from ${url} within ${welcomeTimeoutMs / 1000} seconds.`);
                    socket.close();
                    this.closed(socket, 1006);
                }
            }, welcomeTimeoutMs);
        }
        socket.addEventListener("open", () => {
            this.sendOn(socket, {
                t: "hello",
                v: liveProtocolVersion,
                clientId: this.options.clientId,
                held: this.options.heldKeys().slice(0, liveLimits.keysPerRequest),
                revision: Math.max(0, this.options.revision()),
            });
        });
        socket.addEventListener("message", (event) => {
            let message: ServerMessage;
            try {
                message = JSON.parse(String(event.data)) as ServerMessage;
            } catch {
                return;
            }
            this.receive(socket, message);
        });
        socket.addEventListener("close", (event) => this.closed(socket, event.code));
    }

    private scheduleReconnect() {
        if (this.stopped || this.paused) {
            return;
        }
        this.attempt += 1;
        const base = Math.min(30_000, 1000 * 2 ** Math.min(this.attempt - 1, 5));
        const delay = base * (0.8 + Math.random() * 0.4);
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => void this.connect(false), delay);
        if (this.state.status !== "unavailable") {
            this.update({ status: "reconnecting" });
        }
    }

    reconnectNow() {
        if (this.stopped || this.paused || this.state.status === "open") {
            return;
        }
        clearTimeout(this.reconnectTimer);
        void this.connect(false);
    }

    private closed(socket: WebSocket, code: number) {
        if (socket === this.rotating) {
            this.rotating = null;
            return;
        }
        if (socket !== this.socket || this.stopped || this.paused) {
            return;
        }
        this.socket = null;
        clearTimeout(this.welcomeTimer);
        if (this.state.status !== "open" && !this.state.lastError) {
            this.fail(`The live server closed the connection (code ${code}). Check that it is running and allows this page's origin.`);
        }
        this.pending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ granted: false, conflict: null });
        });
        this.pending.clear();
        if (code === liveCloseCodes.unauthenticated) {
            this.goOffline("Your session ended. Sign in again to collaborate.");
            return;
        }
        if (code === liveCloseCodes.missing || code === liveCloseCodes.badRequest) {
            this.goOffline("Live collaboration stopped for this board.");
            return;
        }
        if (this.rotating) {
            // 갈아탈 소켓이 이미 열리는 중이면 그쪽 welcome을 기다린다.
            this.socket = this.rotating;
            this.rotating = null;
            return;
        }
        this.update({ cursors: new Map(), transients: new Map() });
        if (code === liveCloseCodes.forbidden) {
            this.attempt = 0;
            void this.connect(false);
            return;
        }
        this.scheduleReconnect();
    }

    private receive(socket: WebSocket, message: ServerMessage) {
        if (message.t === "ping") {
            this.sendOn(socket, { t: "pong" });
            return;
        }
        if (message.t === "welcome") {
            this.welcome(socket, message);
            return;
        }
        if (socket !== this.socket) {
            return;
        }
        switch (message.t) {
            case "rotate":
                void this.connect(true);
                return;
            case "presence.join": {
                const peers = new Map(this.state.peers);
                peers.set(message.peer.clientId, message.peer);
                this.update({ peers });
                return;
            }
            case "presence.leave":
                this.forgetPeer(message.clientId);
                return;
            case "frame":
                this.frame(message.cursors, message.transients);
                return;
            case "lock.result": {
                const entry = this.pending.get(message.reqId);
                if (!entry) {
                    return;
                }
                this.pending.delete(message.reqId);
                clearTimeout(entry.timer);
                entry.resolve(message.granted
                    ? { granted: true, keyRevision: message.keyRevision }
                    : { granted: false, conflict: message.conflict });
                return;
            }
            case "lock.acquired": {
                const locks = new Map(this.state.locks);
                message.locks.forEach((lock) => locks.set(lock.key, lock));
                this.update({ locks });
                return;
            }
            case "lock.released": {
                const locks = new Map(this.state.locks);
                for (const key of message.keys) {
                    if (locks.get(key)?.clientId === message.clientId) {
                        locks.delete(key);
                    }
                    this.expireTransient(`${message.clientId}|${key}`, 1500);
                }
                this.update({ locks });
                return;
            }
            case "lock.lost":
                this.options.onLockLost(message.keys);
                return;
            case "commit":
                this.clearTransientsFor(message);
                this.options.onCommit(message);
                return;
        }
    }

    private welcome(socket: WebSocket, message: Extract<ServerMessage, { t: "welcome" }>) {
        if (socket === this.rotating) {
            const previous = this.socket;
            this.socket = socket;
            this.rotating = null;
            previous?.close(liveCloseCodes.rotated, "Rotated.");
        } else if (socket !== this.socket) {
            return;
        }
        this.attempt = 0;
        clearTimeout(this.fallbackTimer);
        this.fallbackTimer = undefined;
        const peers = new Map(message.peers.map((peer) => [peer.clientId, peer]));
        peers.set(message.self.clientId, message.self);
        clearTimeout(this.welcomeTimer);
        this.update({
            status: "open",
            canEdit: message.canEdit,
            peers,
            locks: new Map(message.locks.map((lock) => [lock.key, lock])),
            offlineReason: "",
            lastError: "",
        });
        this.options.onWelcome(message.head);
    }

    private forgetPeer(clientId: string) {
        if (clientId === this.options.clientId) {
            return;
        }
        const peers = new Map(this.state.peers);
        peers.delete(clientId);
        const cursors = new Map(this.state.cursors);
        cursors.delete(clientId);
        const transients = new Map([...this.state.transients].filter(([, item]) => item.clientId !== clientId));
        const locks = new Map([...this.state.locks].filter(([, lock]) => lock.clientId !== clientId));
        this.update({ peers, cursors, transients, locks });
    }

    private frame(cursorUpdates: Extract<ServerMessage, { t: "frame" }>["cursors"], transientUpdates: LiveTransient[]) {
        const cursors = new Map(this.state.cursors);
        for (const cursor of cursorUpdates) {
            if ("hidden" in cursor) {
                cursors.delete(cursor.clientId);
            } else {
                cursors.set(cursor.clientId, { x: cursor.x, y: cursor.y });
            }
        }
        const transients = new Map(this.state.transients);
        for (const item of transientUpdates) {
            const id = `${item.clientId}|${item.key}`;
            transients.set(id, item);
            this.expireTransient(id, 10_000);
        }
        this.update({ cursors, transients });
    }

    private expireTransient(id: string, delay: number) {
        clearTimeout(this.transientExpiry.get(id));
        this.transientExpiry.set(id, setTimeout(() => {
            this.transientExpiry.delete(id);
            if (!this.state.transients.has(id)) {
                return;
            }
            const transients = new Map(this.state.transients);
            transients.delete(id);
            this.update({ transients });
        }, delay));
    }

    private clearTransientsFor(commit: LiveCommit) {
        if (!commit.operations || !commit.by.clientId) {
            return;
        }
        const ids = touchedKeysOf(commit.operations).map((key) => `${commit.by.clientId}|${key}`);
        if (!ids.some((id) => this.state.transients.has(id))) {
            return;
        }
        const transients = new Map(this.state.transients);
        ids.forEach((id) => transients.delete(id));
        this.update({ transients });
    }

    private sendOn(socket: WebSocket | null, message: ClientMessage) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    acquire(keys: string[], intent: LockIntent): Promise<AcquireOutcome> {
        return new Promise((resolve) => {
            const reqId = this.nextRequestId++;
            const sent = this.state.status === "open"
                && this.sendOn(this.socket, { t: "lock.acquire", reqId, keys, intent });
            if (!sent) {
                resolve({ granted: false, conflict: null });
                return;
            }
            const timer = setTimeout(() => {
                this.pending.delete(reqId);
                resolve({ granted: false, conflict: null });
            }, 10_000);
            this.pending.set(reqId, { resolve, timer });
        });
    }

    release(keys: string[]) {
        for (let index = 0; index < keys.length; index += liveLimits.keysPerRequest) {
            this.sendOn(this.socket, { t: "lock.release", keys: keys.slice(index, index + liveLimits.keysPerRequest) });
        }
    }

    publishCursor(point: { x: number; y: number } | null) {
        this.pendingCursor = point;
        if (this.cursorTimer) {
            return;
        }
        this.cursorTimer = setTimeout(() => {
            this.cursorTimer = undefined;
            const value = this.pendingCursor;
            this.pendingCursor = undefined;
            if (value === undefined) {
                return;
            }
            this.sendOn(this.socket, value ? { t: "cursor", x: value.x, y: value.y } : { t: "cursor", hidden: true });
        }, throttleMs);
    }

    publishTransients(items: { key: string; x: number; y: number; width: number; height: number }[]) {
        items.forEach((item) => this.pendingTransients.set(item.key, item));
        if (this.transientTimer) {
            return;
        }
        this.transientTimer = setTimeout(() => {
            this.transientTimer = undefined;
            const batch = [...this.pendingTransients.values()].slice(0, liveLimits.transientsPerMessage);
            this.pendingTransients.clear();
            if (batch.length > 0) {
                this.sendOn(this.socket, { t: "transient", items: batch });
            }
        }, throttleMs);
    }
}

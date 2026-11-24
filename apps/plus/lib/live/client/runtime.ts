import type { BoardDatabaseClient } from "@meldrift/board-data/browser-db/client";
import type { RemoteApplied } from "@meldrift/board-data/browser-db/protocol";
import type { ChangeSync } from "@/lib/change-sync";
import { liveLimits, type LockIntent } from "../protocol";
import { LiveSession, type LiveState } from "./live-session";
import { RemoteApplier } from "./remote-applier";

export type LiveDenial = { keys: string[]; email: string | null; offline: boolean };

export type LiveRuntimeSnapshot = {
    session: LiveState;
    held: ReadonlySet<string>;
    version: number;
};

type RuntimeOptions = {
    boardEndpoint: string;
    database: BoardDatabaseClient;
    initialRevision: number;
    sync: ChangeSync | null;
    onBlocked: (message: string) => void;
};

const releaseDelayMs = 400;
const activityEvents = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
const explicitHoldMs = 1500;
const catchUpTimeoutMs = 5000;

// 잠금 생명주기: 낙관적으로 잡고, 응답 전까지는 그 키의 로컬 변경을 기록하지 않으며,
// 놓은 뒤에는 저장·전송이 끝나야 실제로 푼다.
export class LiveRuntime {
    readonly clientId = crypto.randomUUID();
    readonly session: LiveSession;
    readonly applier: RemoteApplier;
    private held = new Map<string, LockIntent>();
    private pendingKeys = new Set<string>();
    private pendingWaits = new Set<Promise<void>>();
    private catchingUp = new Set<string>();
    private releasing = new Map<string, number>();
    private holdUntil = new Map<string, number>();
    private desired: ReadonlyMap<string, LockIntent> = new Map();
    private remoteListeners = new Set<(applied: RemoteApplied) => void>();
    // 화면이 구독하기 전에 반영된 원격 변경. 구독하는 순간 순서대로 넘긴다.
    private unclaimedBatches: RemoteApplied[] = [];
    private deniedListeners = new Set<(denial: LiveDenial) => void>();
    private listeners = new Set<() => void>();
    private releaseTimer: ReturnType<typeof setInterval> | undefined;
    private releaseBusy = false;
    private syncAttached = false;
    private version = 0;
    private snapshot: LiveRuntimeSnapshot;
    private unsubscribeSession: () => void;
    private stopped = false;
    private lastActivity = Date.now();
    private idleTimer: ReturnType<typeof setInterval> | undefined;

    constructor(private options: RuntimeOptions) {
        this.applier = new RemoteApplier({
            database: options.database,
            boardEndpoint: options.boardEndpoint,
            clientId: this.clientId,
            initialRevision: options.initialRevision,
            onBatch: (applied) => this.deliverRemote(applied),
            onResync: options.onBlocked,
        });
        this.session = new LiveSession({
            boardEndpoint: options.boardEndpoint,
            clientId: this.clientId,
            heldKeys: () => [...this.held.keys()],
            onWelcome: (head) => {
                void this.welcomed(head);
            },
            onHead: (head) => this.applier.noteHead(head),
            onLockLost: (keys) => this.lockLost(keys),
        });
        this.snapshot = { session: this.session.getState(), held: new Set(), version: 0 };
        this.unsubscribeSession = this.session.subscribe(() => this.emit());
    }

    start() {
        this.session.start();
        window.addEventListener("pagehide", this.handlePageHide);
        window.addEventListener("online", this.handleWake);
        document.addEventListener("visibilitychange", this.handleWake);
        for (const type of activityEvents) {
            window.addEventListener(type, this.markActive, { capture: true, passive: true });
        }
        this.idleTimer = setInterval(this.checkIdle, 30_000);
    }

    stop() {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        window.removeEventListener("pagehide", this.handlePageHide);
        window.removeEventListener("online", this.handleWake);
        document.removeEventListener("visibilitychange", this.handleWake);
        for (const type of activityEvents) {
            window.removeEventListener(type, this.markActive, { capture: true });
        }
        clearInterval(this.idleTimer);
        clearInterval(this.releaseTimer);
        this.unsubscribeSession();
        this.applier.stop();
        this.session.stop();
    }

    private handlePageHide = () => {
        this.session.pause();
    };

    private handleWake = () => {
        if (document.visibilityState === "visible") {
            this.markActive();
            this.session.reconnectNow();
        }
    };

    // 화면 입력이 있으면 활동으로 본다. 쉬고 있던 연결은 다시 연다.
    private markActive = () => {
        this.lastActivity = Date.now();
        if (this.session.getState().status === "idle") {
            this.session.resume();
        }
    };

    // 숨겨진 탭도 입력이 없으므로 같은 규칙으로 끊긴다. 잊고 켜 둔 탭이 서버를 붙잡지 않게 한다.
    private checkIdle = () => {
        const status = this.session.getState().status;
        if (status === "idle" || status === "offline") {
            return;
        }
        if (Date.now() - this.lastActivity >= liveLimits.idleDisconnectMs) {
            this.session.pause();
        }
    };

    private async welcomed(head: number) {
        if (!this.syncAttached && this.options.sync) {
            const record = await this.options.database.record();
            this.applier.syncWatermark(record.sync.revision);
        }
        this.attachSync();
        this.applier.noteHead(head);
        // 끊긴 동안(또는 대체 모드에서) 이미 쓰고 있던 카드의 잠금을 다시 잡는다.
        this.syncDesired(this.desired);
    }

    private deliverRemote(applied: RemoteApplied) {
        if (this.remoteListeners.size === 0) {
            this.unclaimedBatches.push(applied);
            return;
        }
        this.remoteListeners.forEach((listener) => listener(applied));
    }

    // ChangeSync는 처음 연결된 뒤에만 Live 규칙으로 바꾼다. Live가 꺼진 배포에서는 기존 동작 그대로다.
    private attachSync() {
        if (this.syncAttached || !this.options.sync) {
            return;
        }
        this.syncAttached = true;
        this.options.sync.attachLive({
            clientId: this.clientId,
            deferredKeys: () => this.deferredKeys(),
            beforeCommit: () => this.settled(),
            onCommitted: (revision, mutationId) => {
                this.applier.noteOwnCommit(revision, mutationId);
                this.session.notifyCommit();
            },
        });
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = () => this.snapshot;

    private emit() {
        this.version += 1;
        this.snapshot = { session: this.session.getState(), held: new Set(this.held.keys()), version: this.version };
        this.listeners.forEach((listener) => listener());
    }

    onRemote(listener: (applied: RemoteApplied) => void) {
        this.remoteListeners.add(listener);
        if (this.unclaimedBatches.length > 0) {
            // 구독 effect 안에서 바로 상태를 바꾸지 않도록 한 박자 늦춘다. 그 사이 구독이 풀리면 다음 구독자에게 넘긴다.
            queueMicrotask(() => {
                if (!this.remoteListeners.has(listener)) {
                    return;
                }
                const batches = this.unclaimedBatches;
                this.unclaimedBatches = [];
                batches.forEach((applied) => listener(applied));
            });
        }
        return () => {
            this.remoteListeners.delete(listener);
        };
    }

    onDenied(listener: (denial: LiveDenial) => void) {
        this.deniedListeners.add(listener);
        return () => {
            this.deniedListeners.delete(listener);
        };
    }

    deferredKeys() {
        const foreign = [...this.session.getState().locks.values()]
            .filter((lock) => lock.clientId !== this.clientId)
            .map((lock) => lock.key);
        return [...new Set([...foreign, ...this.pendingKeys, ...this.catchingUp])];
    }

    private async settled() {
        const waits = [...this.pendingWaits];
        if (waits.length === 0) {
            return;
        }
        await Promise.race([
            Promise.allSettled(waits),
            new Promise((resolve) => setTimeout(resolve, 10_000)),
        ]);
    }

    syncDesired(desired: ReadonlyMap<string, LockIntent>) {
        this.desired = desired;
        let changed = false;
        const open = this.session.getState().status === "open";
        const fresh = [...desired].filter(([key]) => !this.held.has(key) && !this.pendingKeys.has(key));
        if (fresh.length > 0 && open) {
            const intent: LockIntent = fresh.some(([, value]) => value === "edit") ? "edit" : "move";
            this.optimistic(fresh.map(([key]) => key), intent);
            changed = true;
        }
        for (const key of this.held.keys()) {
            if (desired.has(key)) {
                changed = this.releasing.delete(key) || changed;
            } else if (!this.releasing.has(key)) {
                this.markReleasing(key);
            }
        }
        if (changed) {
            this.emit();
        }
    }

    private optimistic(keys: string[], intent: LockIntent) {
        keys.forEach((key) => this.pendingKeys.add(key));
        const wait = (async () => {
            const outcome = await this.session.acquire(keys, intent);
            keys.forEach((key) => this.pendingKeys.delete(key));
            if (!outcome.granted) {
                this.emit();
                const denial = { keys, email: outcome.conflict?.email ?? null, offline: outcome.conflict === null };
                this.deniedListeners.forEach((listener) => listener(denial));
                return;
            }
            this.grant(keys, intent);
            await this.catchUp(keys, outcome.keyRevision);
            this.options.sync?.resave();
        })();
        this.pendingWaits.add(wait);
        void wait.finally(() => this.pendingWaits.delete(wait));
    }

    private grant(keys: string[], intent: LockIntent) {
        for (const key of keys) {
            this.held.set(key, intent);
            if (!this.desired.has(key)) {
                this.markReleasing(key);
            }
        }
        this.emit();
    }

    // 직전 주인의 확정 변경을 아직 받지 못했다면 받을 때까지 그 키를 미룬다.
    private async catchUp(keys: string[], keyRevision: number) {
        if (keyRevision <= this.applier.revision) {
            return;
        }
        keys.forEach((key) => this.catchingUp.add(key));
        this.emit();
        await this.applier.waitFor(keyRevision, catchUpTimeoutMs);
        keys.forEach((key) => this.catchingUp.delete(key));
        this.emit();
    }

    async acquire(keys: string[], intent: LockIntent): Promise<LiveDenial | null> {
        const status = this.session.getState().status;
        // Live를 쓸 수 없는 동안에는 일반 보드처럼 잠금 없이 진행한다.
        if (status === "unavailable") {
            return null;
        }
        if (status !== "open") {
            return { keys, email: null, offline: true };
        }
        const outcome = await this.session.acquire(keys, intent);
        if (!outcome.granted) {
            return { keys, email: outcome.conflict?.email ?? null, offline: outcome.conflict === null };
        }
        const until = Date.now() + explicitHoldMs;
        keys.forEach((key) => this.holdUntil.set(key, until));
        this.grant(keys, intent);
        await this.catchUp(keys, outcome.keyRevision);
        return null;
    }

    private markReleasing(key: string) {
        this.releasing.set(key, Date.now());
        if (!this.releaseTimer) {
            this.releaseTimer = setInterval(() => void this.releaseReady(), 250);
        }
    }

    private async releaseReady() {
        if (this.releaseBusy || this.session.getState().status !== "open") {
            return;
        }
        if (this.releasing.size === 0) {
            clearInterval(this.releaseTimer);
            this.releaseTimer = undefined;
            return;
        }
        this.releaseBusy = true;
        try {
            const now = Date.now();
            const ready = [...this.releasing]
                .filter(([key, since]) => now - since >= releaseDelayMs && now >= (this.holdUntil.get(key) ?? 0))
                .map(([key]) => key)
                .filter((key) => !this.desired.has(key));
            if (ready.length === 0) {
                return;
            }
            const sync = this.options.sync;
            if (sync && !sync.idle()) {
                return;
            }
            const pending = new Set(sync ? await this.options.database.pendingKeys() : []);
            const free = ready.filter((key) => !pending.has(key));
            if (free.length < ready.length) {
                sync?.flushNow();
            }
            if (free.length === 0) {
                return;
            }
            await this.session.release(free);
            for (const key of free) {
                this.held.delete(key);
                this.releasing.delete(key);
                this.holdUntil.delete(key);
            }
            this.emit();
        } catch (error) {
            console.error("live.release_failed", error);
        } finally {
            this.releaseBusy = false;
        }
    }

    private lockLost(keys: string[]) {
        for (const key of keys) {
            this.held.delete(key);
            this.releasing.delete(key);
            this.holdUntil.delete(key);
        }
        this.emit();
        const denial = { keys, email: null, offline: true };
        this.deniedListeners.forEach((listener) => listener(denial));
    }

    publishCursor(point: { x: number; y: number } | null) {
        this.session.publishCursor(point);
    }

    publishTransients(items: { key: string; x: number; y: number; width: number; height: number }[]) {
        this.session.publishTransients(items);
    }
}

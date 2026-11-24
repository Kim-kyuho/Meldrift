import type { LockIntent } from "../protocol";
import { peerRoomLimits, type LockReply, type PeerEvent, type PeerSignal, type RoomGrant, type RoomRequest, type RoomStatus } from "./protocol";
import { PeerTopology } from "./topology";

class LiveRequestError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

async function post<T>(url: string, body: object, token?: string, keepalive = false): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, {
        method: "POST", headers, body: JSON.stringify(body), cache: "no-store", keepalive,
        signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null;
        throw new LiveRequestError(response.status, error?.message ?? "The Live room could not respond.");
    }
    return response.json() as Promise<T>;
}

type RoomEvents = {
    holding: () => boolean;
    status: (room: RoomStatus, connected: boolean) => void;
    error: (reason: string, permanent: boolean) => void;
    received: (clientId: string, event: PeerEvent) => void;
};

const minPulseMs = 500;
const renewTokenMs = 45_000;

// Authenticated HTTP exchanges set up the channels and refresh server-owned metadata.
export class PeerRoomClient {
    private readonly leaseId = crypto.randomUUID();
    private readonly topology: PeerTopology;
    private readonly endpoint: string;
    private token: string | undefined;
    private renewAt = 0;
    private room: RoomStatus | null = null;
    private signals: PeerSignal[] = [];
    private stopped = false;
    private working = false;
    private wakeRequested = false;
    private nextPulseAt = Infinity;
    private lastPulseAt = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(boardEndpoint: string, private clientId: string, private events: RoomEvents) {
        // Use the page's public base path, including on unload when a Referer can be absent.
        const basePath = window.location.pathname.startsWith("/plus/") ? "/plus" : "";
        this.endpoint = `${basePath}${boardEndpoint}/live`;
        this.topology = new PeerTopology(clientId, {
            signal: (signal) => {
                this.signals.push(signal);
                this.wake();
            },
            changed: () => this.report(),
            received: (from, event) => {
                if (event.kind === "refresh") {
                    this.wake();
                } else {
                    this.events.received(from, event);
                }
            },
        });
    }

    wake() {
        if (this.working) {
            this.wakeRequested = true;
        } else {
            this.schedule(0);
        }
    }

    stop() {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        clearTimeout(this.timer);
        this.topology.clear();
        if (this.token) {
            void this.leave(this.token);
        }
    }

    send(event: PeerEvent) {
        if (!this.stopped) {
            this.topology.send(event);
        }
    }

    async acquire(keys: string[], intent: LockIntent): Promise<LockReply> {
        const result = await this.command<LockReply>({ kind: "acquire", keys, intent });
        if (result.granted) {
            this.send({ kind: "refresh" });
            this.wake();
        }
        return result;
    }

    async release(keys: string[]) {
        await this.command({ kind: "release", keys });
        this.send({ kind: "refresh" });
        this.wake();
    }

    private command<T>(body: RoomRequest) {
        if (this.stopped || !this.token) {
            return Promise.reject(new Error("Live collaboration is disconnected."));
        }
        return post<T>(this.endpoint, body, this.token);
    }

    private async leave(token: string) {
        await post(this.endpoint, { kind: "leave" }, token, true).catch(() => {});
    }

    private schedule(delay: number) {
        const now = Date.now();
        const at = Math.max(now + delay, this.lastPulseAt + minPulseMs);
        if (this.stopped || at >= this.nextPulseAt) {
            return;
        }
        clearTimeout(this.timer);
        this.nextPulseAt = at;
        this.timer = setTimeout(() => void this.pulse(), at - now);
    }

    private takeSignals() {
        let count = 0;
        let hasDescription = false;
        for (const signal of this.signals) {
            const description = "sdp" in signal;
            if (count === 8 || (description && hasDescription)) {
                break;
            }
            hasDescription ||= description;
            count += 1;
        }
        return this.signals.slice(0, count);
    }

    private async pulse() {
        if (this.stopped) {
            return;
        }
        this.nextPulseAt = Infinity;
        this.lastPulseAt = Date.now();
        this.working = true;
        const room = this.room;
        const joining = !this.token || !room || this.lastPulseAt >= this.renewAt;
        let retryDelay = 0;
        try {
            if (joining) {
                const grant = await post<RoomGrant>(`${this.endpoint}/token`, { clientId: this.clientId, leaseId: this.leaseId });
                if (this.stopped) {
                    await this.leave(grant.token);
                    return;
                }
                this.token = grant.token;
                this.renewAt = Date.now() + renewTokenMs;
                this.accept(grant.status);
            } else {
                const signals = this.takeSignals();
                const status = await this.command<RoomStatus>({
                    kind: "pulse", epoch: room.epoch, signals, holding: this.events.holding(),
                });
                this.signals.splice(0, signals.length);
                this.accept(status);
            }
        } catch (error) {
            if (this.stopped) {
                return;
            }
            const code = error instanceof LiveRequestError ? error.status : 0;
            if (joining && (code === 401 || code === 403 || code === 404)) {
                this.events.error(error instanceof Error ? error.message : "Live collaboration is unavailable.", true);
                this.stop();
                return;
            }
            if (code === 401 || code === 410) {
                this.token = undefined;
            }
            retryDelay = code === 409 ? peerRoomLimits.pulseMs : 2_000;
            this.events.error(error instanceof Error ? error.message : "Live collaboration is unavailable.", false);
        } finally {
            this.working = false;
            const negotiating = this.room?.negotiations.some((link) => !link.connected);
            const delay = this.wakeRequested || this.signals.length ? 0 : negotiating ? 900 : peerRoomLimits.pulseMs;
            this.wakeRequested = false;
            this.schedule(retryDelay || delay);
        }
    }

    private accept(room: RoomStatus) {
        if (this.stopped) {
            return;
        }
        if (this.room?.epoch !== room.epoch) {
            this.signals = [];
        }
        this.room = room;
        this.topology.reconcile(room);
        this.report();
    }

    private report() {
        if (this.room && !this.stopped) {
            this.events.status(this.room, this.topology.ready);
        }
    }
}

import { PeerEditor } from "./board/editor";
import { decodeBoardPacket, encodeBoardPacket } from "./board/wire";
import { hostControl, peerPresenceFrame, peerProtocolVersion, type LockOutcome } from "./protocol";
import { makeParticipantToken, RoomSignaling, SignalError } from "./signaling/client";
import { roomIdSchema, roomLimits, tokenSchema, type ParticipantGrant } from "./signaling/protocol";
import { PeerLink } from "./transport/peer-link";
import type { Packet } from "./transport/packets";
import { Replies } from "./transport/replies";

type SavedSeat = { token: string; attemptId: string };
const savedSeatKey = (roomId: string) => `meldrift:peer-seat:${roomId}`;
const directFailure = "Could not connect directly to the host. Try a different network or ask the host to start a new room.";

function saveSeat(roomId: string, value: SavedSeat | null) {
    try {
        if (value) {
            sessionStorage.setItem(savedSeatKey(roomId), JSON.stringify(value));
        } else {
            sessionStorage.removeItem(savedSeatKey(roomId));
        }
    } catch {
        // The active connection does not depend on sessionStorage being enabled.
    }
}

export function storedSeat(roomId: string): SavedSeat | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(savedSeatKey(roomId)) ?? "null");
        return tokenSchema.safeParse(value?.token).success && roomIdSchema.safeParse(value?.attemptId).success ? value : null;
    } catch {
        return null;
    }
}

type ParticipantAttempt = {
    id: string;
    link: PeerLink;
    answer?: string;
    opened: boolean;
    ready: boolean;
    receiving: Promise<void>;
    queuedBytes: number;
};

export class ParticipantRoom {
    readonly editor: PeerEditor;
    private readonly signaling: RoomSignaling;
    private readonly locks = new Replies<LockOutcome>();
    private readonly saves = new Replies<void>();
    private attempt: ParticipantAttempt | null = null;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private transferTimer: ReturnType<typeof setTimeout> | undefined;
    private deadline = Date.now() + roomLimits.approvalMs + 5_000;
    private negotiationStarted = false;
    private hasConnected = false;
    private stopped = false;
    private retrying = false;

    static async join(roomId: string, invitation: string, name: string) {
        const token = makeParticipantToken();
        const grant = await new RoomSignaling(roomId, invitation).join({ kind: "join", name, participantToken: token });
        return new ParticipantRoom(grant, token);
    }

    static async resume(roomId: string, seat: SavedSeat) {
        try {
            const grant = await new RoomSignaling(roomId, seat.token).join({ kind: "resume", attemptId: seat.attemptId });
            return new ParticipantRoom(grant, seat.token);
        } catch (error) {
            if (error instanceof SignalError && [403, 410].includes(error.status)) {
                saveSeat(roomId, null);
            }
            throw error;
        }
    }

    private constructor(private grant: ParticipantGrant, private readonly token: string) {
        this.signaling = new RoomSignaling(grant.roomId, token);
        this.editor = new PeerEditor(grant.participantId, {
            acquire: (keys, intent) => {
                const link = this.activeLink();
                const id = crypto.randomUUID();
                const reply = this.locks.wait(id, 6_000, "The host did not respond to the edit lock request.");
                link.sendControl({ kind: "acquire", id, keys, intent });
                return reply;
            },
            release: (keys) => this.attempt?.link.sendControl({ kind: "release", keys }),
            propose: async (proposal) => {
                const link = this.activeLink();
                const packet = await encodeBoardPacket(proposal);
                const id = proposal.change.mutationId;
                const reply = this.saves.wait(id, 35_000, "The host did not confirm the save.");
                void link.sendPacket(packet).catch(() => this.saves.reject(id, new Error("Could not send the change to the host.")));
                await reply;
            },
            presence: (frame) => this.attempt?.link.sendPresence(frame),
        });
        this.storeGrant();
        this.editor.setStatus("connecting", `Waiting for ${grant.hostName} to let you in…`);
        this.schedule(0);
    }

    leave() {
        void this.signaling.leave(this.grant.attemptId).catch(() => {});
        this.finish("You left the room.");
    }

    dispose() {
        this.shutdown();
        this.editor.dispose();
    }

    private activeLink() {
        if (this.stopped || !this.attempt?.ready || !this.attempt.opened) {
            throw new Error("The host is disconnected.");
        }
        return this.attempt.link;
    }

    private storeGrant() {
        saveSeat(this.grant.roomId, { token: this.token, attemptId: this.grant.attemptId });
    }

    private schedule(delay: number) {
        if (this.stopped || this.attempt?.opened) {
            return;
        }
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.poll(), delay);
    }

    private async poll() {
        if (this.stopped || this.attempt?.opened) {
            return;
        }
        if (Date.now() >= this.deadline) {
            this.finish(this.negotiationStarted ? directFailure : "The host did not approve the request in time.");
            return;
        }

        try {
            const result = await this.signaling.participantExchange(this.grant.attemptId, this.attempt?.answer);
            if (this.stopped || this.attempt?.opened) {
                return;
            }
            if (result.state === "denied") {
                this.finish("The host did not approve this request.");
                return;
            }
            if (result.state === "negotiating" && !this.negotiationStarted) {
                this.negotiationStarted = true;
                this.deadline = Date.now() + roomLimits.negotiationMs;
                this.editor.setStatus(this.hasConnected ? "reconnecting" : "connecting", "Opening a direct connection…");
            }
            if (result.offer && !this.attempt) {
                await this.startAttempt(result.offer);
            }
        } catch (error) {
            if (error instanceof SignalError && error.status < 429) {
                this.finish(error.code === "forbidden" && this.negotiationStarted ? directFailure : error.message);
                return;
            }
        }
        this.schedule(this.negotiationStarted ? 1_000 : 1_500);
    }

    private async startAttempt(offer: string) {
        const attempt: ParticipantAttempt = {
            id: this.grant.attemptId, opened: false, ready: false, receiving: Promise.resolve(), queuedBytes: 0,
            link: new PeerLink(false, {
                onOpen: () => this.connected(attempt),
                onClose: (message) => this.disconnected(attempt, message),
                onControl: (message) => this.receiveControl(attempt, message),
                onPresence: (message) => {
                    const result = peerPresenceFrame.safeParse(message);
                    if (result.success && this.attempt === attempt) {
                        this.editor.receivePresence(result.data.peerId, result.data);
                    }
                },
                onPacket: (packet) => this.receivePacket(attempt, packet),
            }),
        };
        this.attempt = attempt;
        try {
            attempt.answer = await attempt.link.answer(offer);
            const result = await this.signaling.participantExchange(attempt.id, attempt.answer);
            if (result.state === "denied") {
                this.finish("The host did not approve this connection.");
            }
        } catch {
            if (!attempt.answer) {
                attempt.link.close(directFailure);
            }
        }
    }

    private connected(attempt: ParticipantAttempt) {
        if (this.attempt !== attempt || this.stopped) {
            return;
        }
        attempt.opened = true;
        clearTimeout(this.timer);
        this.editor.setStatus(this.hasConnected ? "reconnecting" : "connecting", "Receiving the shared board…");
        this.transferTimer = setTimeout(() => attempt.link.close("The board transfer timed out."), 4 * 60_000);
        attempt.link.sendControl({ kind: "hello", version: peerProtocolVersion, epoch: this.grant.epoch, attemptId: attempt.id });
    }

    private receiveControl(attempt: ParticipantAttempt, value: unknown) {
        if (this.attempt !== attempt || this.stopped) {
            return;
        }
        const result = hostControl.safeParse(value);
        if (!result.success) {
            return;
        }
        const message = result.data;
        switch (message.kind) {
            case "state":
                this.editor.setState(message.peers, message.locks);
                if (attempt.ready && message.peers.some(({ id }) => id === this.grant.participantId)) {
                    this.hasConnected = true;
                    clearTimeout(this.transferTimer);
                    this.editor.setStatus("open");
                }
                break;
            case "lock":
                this.locks.resolve(message.id, message.outcome);
                break;
            case "rejected":
                this.saves.reject(message.mutationId, new Error(message.message));
                break;
            case "ended":
                this.finish(message.message);
                break;
        }
    }

    private receivePacket(attempt: ParticipantAttempt, packet: Packet) {
        const bytes = packet.assets.reduce((total, asset) => total + asset.byteLength, 0);
        if (attempt.queuedBytes + bytes > 64 * 1024 * 1024) {
            attempt.link.close("Too much board data arrived at once.");
            return;
        }
        attempt.queuedBytes += bytes;
        attempt.receiving = attempt.receiving.then(async () => {
            const decoded = await decodeBoardPacket(packet);
            if (this.attempt !== attempt || this.stopped) {
                return;
            }
            if (decoded.kind === "snapshot" && !attempt.ready) {
                this.editor.install(decoded.board, decoded.revision);
            } else if (decoded.kind === "commit") {
                this.editor.accept(decoded);
                if (decoded.author === this.grant.participantId) {
                    this.saves.resolve(decoded.change.mutationId, undefined);
                }
            } else if (decoded.kind === "ready" && this.editor.replica.board && decoded.revision === this.editor.replica.revision) {
                attempt.ready = true;
                attempt.link.sendControl({ kind: "synced", revision: decoded.revision });
            } else {
                throw new Error("Unexpected board message.");
            }
        }).catch(() => attempt.link.close("The shared board could not be read.")).finally(() => {
            attempt.queuedBytes -= bytes;
        });
    }

    private disconnected(attempt: ParticipantAttempt, message: string) {
        if (this.attempt !== attempt || this.stopped) {
            return;
        }
        this.attempt = null;
        clearTimeout(this.transferTimer);
        this.locks.clear(message);
        this.saves.clear(message);
        if (!this.hasConnected) {
            this.finish(attempt.opened ? message : directFailure);
            return;
        }
        this.editor.setStatus("reconnecting", "Lost the connection to the host. Reconnecting…");
        void this.reconnect();
    }

    private async reconnect() {
        if (this.retrying) {
            return;
        }
        this.retrying = true;
        const deadline = Date.now() + roomLimits.reconnectMs;
        try {
            while (!this.stopped && Date.now() < deadline) {
                try {
                    const grant = await this.signaling.join({ kind: "resume", attemptId: this.grant.attemptId });
                    if (this.stopped) {
                        return;
                    }
                    this.grant = grant;
                    this.storeGrant();
                    this.negotiationStarted = false;
                    this.deadline = Date.now() + roomLimits.negotiationMs;
                    this.schedule(0);
                    return;
                } catch (error) {
                    if (error instanceof SignalError && error.status < 429) {
                        this.finish(error.message);
                        return;
                    }
                    await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
                }
            }
            if (!this.stopped) {
                this.finish("Could not reconnect to the host.");
            }
        } finally {
            this.retrying = false;
        }
    }

    private finish(message: string) {
        this.shutdown();
        saveSeat(this.grant.roomId, null);
        this.editor.setStatus("offline", message);
    }

    private shutdown() {
        this.stopped = true;
        clearTimeout(this.timer);
        clearTimeout(this.transferTimer);
        this.locks.clear("The room disconnected.");
        this.saves.clear("The room disconnected.");
        this.attempt?.link.close();
        this.attempt = null;
    }
}

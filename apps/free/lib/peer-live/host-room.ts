import type { BoardSnapshot } from "@meldrift/board-data/board-state";
import { BoardAuthority, ProposalError, type Intent } from "./board/authority";
import { PeerEditor } from "./board/editor";
import { requireShareableMemos } from "./board/memo-content";
import { decodeBoardPacket, encodeBoardPacket, validateShareableBoard, type BoardCommit } from "./board/wire";
import { colors, participantControl, presenceFrame, type Peer, type PresenceFrame } from "./protocol";
import { createRoom, invitationUrl, RoomSignaling, SignalError } from "./signaling/client";
import type { HostGrant, HostUpdate, RoomRole, RoomSeat } from "./signaling/protocol";
import { PeerLink } from "./transport/peer-link";
import type { Packet } from "./transport/packets";

type HostAttempt = {
    peer: Peer;
    id: string;
    link: PeerLink;
    submit: ReturnType<BoardAuthority["proposalsFrom"]>;
    sendQueue: Promise<void>;
    queuedPackets: number;
    answered: boolean;
    linked: boolean;
    verified: boolean;
    transferring: boolean;
    synced: boolean;
    receiving: boolean;
    lastFrameAt: number;
};

type HostView = { url: string; seats: RoomSeat[]; error: string; ended: boolean };
type PersistBoard = (board: BoardSnapshot) => Promise<void>;

export class HostRoom {
    readonly editor: PeerEditor;
    private readonly signaling: RoomSignaling;
    private readonly authority: BoardAuthority;
    private readonly host: Peer;
    private readonly attempts = new Map<string, HostAttempt>();
    private readonly closedAttempts = new Set<string>();
    private readonly updates: HostUpdate[] = [];
    private readonly listeners = new Set<() => void>();
    private view: HostView;
    private leaseExpiresAt: number;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private polling = false;
    private closing: Promise<BoardSnapshot> | null = null;
    private stopped = false;

    static async open(name: string, snapshot: BoardSnapshot, persist: PersistBoard) {
        const board = validateShareableBoard(snapshot);
        requireShareableMemos(board.memos);
        await persist(board);
        const room = await createRoom(name);
        return new HostRoom(room, board, persist);
    }

    private constructor(private readonly grant: HostGrant, board: BoardSnapshot, persist: PersistBoard) {
        this.signaling = new RoomSignaling(grant.roomId, grant.hostToken);
        this.host = { id: grant.hostId, name: grant.hostName, role: "editor", color: colors[0] };
        this.view = { url: invitationUrl(grant.roomId, grant.inviteSecret), seats: [], error: "", ended: false };
        this.leaseExpiresAt = grant.leaseExpiresAt;
        this.authority = new BoardAuthority(board, persist, (commit) => this.announceCommit(commit));
        this.editor = new PeerEditor(this.host.id, {
            acquire: async (keys, intent) => this.acquire(this.host, keys, intent),
            release: (keys) => this.release(this.host.id, keys),
            propose: this.authority.proposalsFrom(this.host, () => this.isOpen()),
            presence: (frame) => this.broadcastPresence(this.host.id, frame),
        });
        this.editor.install(board, 0);
        this.publishState();
        this.editor.setStatus("open");
        this.schedule(0);
    }

    getSnapshot = () => this.view;

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    decide(seat: RoomSeat, role: RoomRole | null) {
        const attempt = { participantId: seat.participantId, attemptId: seat.attemptId };
        this.enqueue(role ? { ...attempt, kind: "approve", role } : { ...attempt, kind: "deny" });
    }

    async rotateInvite() {
        const { inviteSecret } = await this.signaling.manage({ kind: "rotate" });
        if (inviteSecret) {
            this.emit({ url: invitationUrl(this.grant.roomId, inviteSecret) });
        }
        this.schedule(0);
    }

    async remove(participantId: string) {
        await this.signaling.manage({ kind: "remove", participantId });
        const attempt = this.attempts.get(participantId);
        if (attempt) {
            attempt.link.sendControl({ kind: "ended", message: "The host ended your access to the room." });
            attempt.link.close();
        }
        this.schedule(0);
    }

    end(message = "The host ended the room.") {
        this.closing ??= this.endRoom(message);
        return this.closing;
    }

    private async endRoom(message: string) {
        this.stopped = true;
        clearTimeout(this.timer);
        this.editor.setStatus("offline", message);
        await this.authority.end();
        for (const { link } of this.attempts.values()) {
            link.sendControl({ kind: "ended", message });
            link.close();
        }
        this.attempts.clear();
        this.editor.dispose();
        this.emit({ ended: true, seats: [], error: message });
        void this.signaling.close().catch(() => {});
        return this.authority.board;
    }

    private isOpen() {
        return !this.stopped && Date.now() < this.leaseExpiresAt;
    }

    private enqueue(update: HostUpdate) {
        if (this.stopped) {
            return;
        }
        this.updates.push(update);
        this.schedule(0);
    }

    private schedule(delay: number) {
        if (this.stopped) {
            return;
        }
        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.poll(), delay);
    }

    private async poll() {
        if (this.polling || this.stopped) {
            return;
        }
        if (!this.isOpen()) {
            await this.end("The room expired. Start a new room to share the saved board.");
            return;
        }
        this.polling = true;
        let count = 0;
        let hasOffer = false;
        for (const update of this.updates) {
            if (count === 12 || (update.kind === "offer" && hasOffer)) {
                break;
            }
            hasOffer ||= update.kind === "offer";
            count += 1;
        }
        let retryDelay = 0;
        try {
            const response = await this.signaling.hostExchange(this.updates.slice(0, count));
            if (this.stopped) {
                return;
            }
            this.updates.splice(0, count);
            this.leaseExpiresAt = response.leaseExpiresAt;
            this.reconcile(response.seats);
            this.emit({ seats: response.seats, error: "" });
        } catch (error) {
            if (error instanceof SignalError && (error.status === 410 || error.status === 403)) {
                await this.end(error.message);
                return;
            }
            retryDelay = 3_000;
            this.emit({ error: "Could not check invitations. Retrying…" });
        } finally {
            this.polling = false;
            const negotiating = this.view.seats.some(({ state }) => state === "negotiating");
            this.schedule(retryDelay || (this.updates.length > 0 ? 0 : negotiating ? 1_000 : 5_000));
        }
    }

    private reconcile(seats: RoomSeat[]) {
        for (const attempt of this.attempts.values()) {
            if (!seats.some((seat) => seat.participantId === attempt.peer.id && seat.attemptId === attempt.id)) {
                attempt.link.close();
            }
        }
        for (const attemptId of this.closedAttempts) {
            if (!seats.some((seat) => seat.attemptId === attemptId)) {
                this.closedAttempts.delete(attemptId);
            }
        }
        for (const seat of seats) {
            if (seat.state !== "negotiating" || !seat.role || this.closedAttempts.has(seat.attemptId)) {
                continue;
            }
            const attempt = this.attempts.get(seat.participantId) ?? this.startAttempt(seat, seat.role);
            if (seat.answer && !attempt.answered) {
                attempt.answered = true;
                void attempt.link.acceptAnswer(seat.answer).catch(() => attempt.link.close("Could not establish a direct connection."));
            }
        }
    }

    private startAttempt(seat: RoomSeat, role: RoomRole) {
        const usedColors = new Set([...this.attempts.values()].map(({ peer }) => peer.color));
        const peer = { id: seat.participantId, name: seat.name, role, color: colors.slice(1).find((color) => !usedColors.has(color)) ?? colors[1] };
        const attempt: HostAttempt = {
            id: seat.attemptId, peer,
            answered: false, linked: false, verified: false, transferring: false, synced: false, receiving: false, lastFrameAt: 0,
            sendQueue: Promise.resolve(), queuedPackets: 0,
            submit: this.authority.proposalsFrom(peer, () => this.isOpen() && this.attempts.get(peer.id) === attempt),
            link: new PeerLink(true, {
                onOpen: () => {
                    attempt.linked = true;
                    this.sendInitialBoard(attempt);
                },
                onClose: () => this.drop(attempt),
                onControl: (data) => this.receiveControl(attempt, data),
                onPresence: (data) => this.receivePresence(attempt, data),
                onPacket: (packet) => void this.receiveProposal(attempt, packet),
            }),
        };
        this.attempts.set(peer.id, attempt);
        void attempt.link.offer().then((sdp) => {
            if (this.attempts.get(peer.id) === attempt) {
                this.enqueue({ kind: "offer", participantId: peer.id, attemptId: attempt.id, sdp });
            }
        }).catch(() => attempt.link.close("Could not establish a direct connection."));
        return attempt;
    }

    private sendInitialBoard(attempt: HostAttempt) {
        if (!attempt.linked || !attempt.verified || attempt.transferring || !this.isOpen()) {
            return;
        }
        attempt.transferring = true;
        this.enqueue({ kind: "connected", participantId: attempt.peer.id, attemptId: attempt.id });
        const snapshot = encodeBoardPacket({ kind: "snapshot", revision: this.authority.revision, board: this.authority.board });
        void this.send(attempt, snapshot).then(() => {
            if (this.attempts.get(attempt.peer.id) === attempt) {
                void this.send(attempt, encodeBoardPacket({ kind: "ready", revision: this.authority.revision }));
            }
        });
    }

    private send(attempt: HostAttempt, packet: Promise<Packet>) {
        // Preparation can finish out of order. Sending always follows the commit queue.
        void packet.catch(() => {});
        if (attempt.queuedPackets >= 32) {
            attempt.link.close("The board is updating faster than this connection can receive it.");
            return Promise.resolve();
        }
        attempt.queuedPackets += 1;
        attempt.sendQueue = attempt.sendQueue.then(async () => attempt.link.sendPacket(await packet))
            .catch(() => attempt.link.close("Could not send the shared board."))
            .finally(() => {
                attempt.queuedPackets -= 1;
            });
        return attempt.sendQueue;
    }

    private announceCommit(commit: BoardCommit) {
        this.editor.accept(commit);
        const recipients = [...this.attempts.values()].filter(({ transferring }) => transferring);
        if (recipients.length === 0) {
            return;
        }
        const packet = encodeBoardPacket(commit);
        for (const attempt of recipients) {
            void this.send(attempt, packet);
        }
    }

    private receiveControl(attempt: HostAttempt, value: unknown) {
        const result = participantControl.safeParse(value);
        if (!result.success || !this.isOpen()) {
            return;
        }
        const message = result.data;
        if (message.kind === "hello") {
            if (message.epoch !== this.grant.epoch || message.attemptId !== attempt.id) {
                attempt.link.close("This connection is no longer valid.");
                return;
            }
            attempt.verified = true;
            this.sendInitialBoard(attempt);
        } else if (message.kind === "synced" && attempt.transferring) {
            attempt.synced = true;
            this.publishState();
        } else if (attempt.synced && message.kind === "acquire") {
            const outcome = this.acquire(attempt.peer, message.keys, message.intent);
            attempt.link.sendControl({ kind: "lock", id: message.id, outcome });
        } else if (attempt.synced && message.kind === "release") {
            this.release(attempt.peer.id, message.keys);
        }
    }

    private async receiveProposal(attempt: HostAttempt, packet: Packet) {
        if (!attempt.synced || attempt.peer.role !== "editor" || attempt.receiving) {
            attempt.link.close("This connection cannot send board changes.");
            return;
        }
        attempt.receiving = true;
        try {
            const proposal = await decodeBoardPacket(packet);
            if (proposal.kind !== "propose") {
                throw new Error("Expected a proposed change.");
            }
            try {
                await attempt.submit(proposal);
            } catch (error) {
                attempt.link.sendControl({
                    kind: "rejected", mutationId: proposal.change.mutationId,
                    message: error instanceof ProposalError ? error.message : "The host could not save this change.",
                });
            }
        } catch {
            attempt.link.close("The peer sent an invalid board change.");
        } finally {
            attempt.receiving = false;
        }
    }

    private acquire(peer: Peer, keys: string[], intent: Intent) {
        if (!this.isOpen()) {
            return { granted: false as const, owner: null };
        }
        const result = this.authority.acquire(peer, keys, intent);
        if (result.granted) {
            this.publishState();
        }
        return result;
    }

    private release(peerId: string, keys: string[]) {
        this.authority.release(peerId, keys);
        this.publishState();
    }

    private receivePresence(attempt: HostAttempt, value: unknown) {
        if (!attempt.synced || Date.now() - attempt.lastFrameAt < 40) {
            return;
        }
        const result = presenceFrame.safeParse(value);
        if (!result.success) {
            return;
        }
        attempt.lastFrameAt = Date.now();
        const transients = result.data.transients.filter(({ key }) =>
            this.authority.getLocks().some((lock) => lock.key === key && lock.owner === attempt.peer.id));
        this.broadcastPresence(attempt.peer.id, { ...result.data, transients });
    }

    private broadcastPresence(peerId: string, frame: PresenceFrame) {
        this.editor.receivePresence(peerId, frame);
        for (const attempt of this.attempts.values()) {
            if (attempt.synced && attempt.peer.id !== peerId) {
                attempt.link.sendPresence({ ...frame, peerId });
            }
        }
    }

    private publishState() {
        const active = [...this.attempts.values()].filter(({ synced }) => synced);
        const peers = [this.host, ...active.map(({ peer }) => peer)];
        const locks = this.authority.getLocks();
        this.editor.setState(peers, locks);
        for (const { link } of active) {
            link.sendControl({ kind: "state", peers, locks });
        }
    }

    private drop(attempt: HostAttempt) {
        const id = attempt.peer.id;
        if (this.attempts.get(id) !== attempt) {
            return;
        }
        this.attempts.delete(id);
        this.closedAttempts.add(attempt.id);
        this.authority.release(id);
        this.enqueue({ kind: "disconnected", participantId: id, attemptId: attempt.id });
        if (!this.stopped) {
            this.publishState();
        }
    }

    private emit(update: Partial<HostView>) {
        this.view = { ...this.view, ...update };
        this.listeners.forEach((listener) => listener());
    }
}

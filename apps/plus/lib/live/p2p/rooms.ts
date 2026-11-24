import { randomUUID } from "node:crypto";
import { maskEmail, type LivePeer } from "../protocol";
import type { LiveStore } from "../store";
import { peerRoomLimits, type Negotiation, type PeerSignal, type RoomView } from "./protocol";

export type RoomSeat = LivePeer & { userId: number; leaseId: string; seesEmails: boolean; expiresAt: number };
type SeatKey = Pick<RoomSeat, "userId" | "clientId" | "leaseId">;
type StoredNegotiation = Negotiation & { leaseId: string; deadline: number };
type Room = {
    epoch: string;
    hostId: string | null;
    hostLeaseId: string | null;
    seats: RoomSeat[];
    negotiations: StoredNegotiation[];
};

export class RoomFailure extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

const emptyRoom = (): Room => ({
    epoch: randomUUID(), hostId: null, hostLeaseId: null, seats: [], negotiations: [],
});

function startNegotiation(seat: RoomSeat, now: number): StoredNegotiation {
    return {
        guestId: seat.clientId, leaseId: seat.leaseId, attemptId: randomUUID(),
        connected: false, deadline: now + peerRoomLimits.negotiationMs,
    };
}

function reconcile(room: Room, now: number) {
    room.seats = room.seats.filter((seat) => seat.expiresAt > now);
    const editors = room.seats.filter((seat) => seat.role === "editor");
    const host = editors.find((seat) => seat.clientId === room.hostId && seat.leaseId === room.hostLeaseId) ?? editors[0];
    const hostId = host?.clientId ?? null;
    const hostLeaseId = host?.leaseId ?? null;
    if (hostId !== room.hostId || hostLeaseId !== room.hostLeaseId) {
        room.hostId = hostId;
        room.hostLeaseId = hostLeaseId;
        room.epoch = randomUUID();
        room.negotiations = [];
    }
    room.negotiations = host ? room.seats.filter((seat) => seat !== host).map((seat) => {
        const current = room.negotiations.find(({ guestId, leaseId }) => guestId === seat.clientId && leaseId === seat.leaseId);
        return current && (current.connected || current.deadline > now) ? current : startNegotiation(seat, now);
    }) : [];
}

function requireSeat(room: Room, key: SeatKey) {
    const seat = room.seats.find((entry) => entry.clientId === key.clientId
        && entry.leaseId === key.leaseId && entry.userId === key.userId);
    if (!seat) {
        throw new RoomFailure(410, "Your Live seat expired. Reconnecting…");
    }
    return seat;
}

function readView(room: Room, self: RoomSeat): RoomView {
    const host = room.hostId === self.clientId;
    const peerOf = ({ clientId, userId, email, role, color, joinedAt }: RoomSeat): LivePeer => ({
        clientId, userId, email: self.seesEmails || clientId === self.clientId ? email : maskEmail(email),
        role, color, joinedAt,
    });
    const connected = new Set(room.negotiations.filter(({ connected }) => connected).map(({ guestId }) => guestId));
    const peers = room.seats.filter(({ clientId }) => clientId === self.clientId || clientId === room.hostId || connected.has(clientId));
    const negotiations = room.negotiations.filter(({ guestId }) => host || guestId === self.clientId)
        .map(({ guestId, attemptId, connected, offer, answer }) => ({
            guestId, attemptId, connected, offer: host ? undefined : offer, answer: host ? answer : undefined,
        }));
    return { epoch: room.epoch, hostId: room.hostId, self: peerOf(self), peers: peers.map(peerOf), negotiations };
}

function applySignal(room: Room, self: RoomSeat, signal: PeerSignal, now: number) {
    const link = room.negotiations.find(({ guestId, attemptId }) =>
        guestId === signal.guestId && attemptId === signal.attemptId);
    if (!link) {
        return;
    }
    const isHost = room.hostId === self.clientId;
    const isGuest = link.guestId === self.clientId;
    switch (signal.kind) {
        case "offer":
            if (isHost && !link.connected && !link.offer) {
                link.offer = signal.sdp;
            }
            break;
        case "answer":
            if (isGuest && link.offer && !link.answer) {
                link.answer = signal.sdp;
            }
            break;
        case "connected":
            if (isHost && link.offer && link.answer) {
                link.connected = true;
                delete link.offer;
                delete link.answer;
            }
            break;
        case "retry":
            if (isHost || isGuest) {
                link.attemptId = randomUUID();
                link.deadline = now + peerRoomLimits.negotiationMs;
                link.connected = false;
                delete link.offer;
                delete link.answer;
            }
            break;
    }
}

export class PeerRooms {
    constructor(private store: LiveStore, private boardId: number, private now = Date.now) {}

    join(seat: RoomSeat) {
        return this.update((room, now) => {
            const existing = room.seats.find(({ clientId }) => clientId === seat.clientId);
            if (existing && existing.userId !== seat.userId) {
                throw new RoomFailure(403, "This Live client is assigned to a different user.");
            }
            if (!existing && room.seats.length >= peerRoomLimits.seats) {
                throw new RoomFailure(409, "This Live board already has eight people.");
            }
            if (existing) {
                Object.assign(existing, seat, { joinedAt: existing.joinedAt });
            } else {
                room.seats.push(seat);
            }
            reconcile(room, now);
            return readView(room, requireSeat(room, seat));
        });
    }

    pulse(key: SeatKey, expiresAt: number, epoch: string, signals: PeerSignal[]) {
        return this.update((room, now) => {
            const seat = requireSeat(room, key);
            seat.expiresAt = Math.min(now + peerRoomLimits.leaseMs, expiresAt);
            if (epoch === room.epoch) {
                signals.forEach((signal) => applySignal(room, seat, signal, now));
            }
            return { seat, view: readView(room, seat) };
        });
    }

    async seat(key: SeatKey) {
        const room = await this.read();
        reconcile(room, this.now());
        return requireSeat(room, key);
    }

    leave(key: SeatKey) {
        return this.update((room) => {
            const index = room.seats.findIndex(({ clientId, userId, leaseId }) =>
                clientId === key.clientId && userId === key.userId && leaseId === key.leaseId);
            if (index < 0) {
                return false;
            }
            room.seats.splice(index, 1);
            return true;
        });
    }

    private async read() {
        const raw = await this.store.readPeerRoom(this.boardId);
        return raw ? JSON.parse(raw) as Room : emptyRoom();
    }

    private async update<T>(apply: (room: Room, now: number) => T): Promise<T> {
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const current = await this.store.readPeerRoom(this.boardId);
            const room = current ? JSON.parse(current) as Room : emptyRoom();
            const now = this.now();
            reconcile(room, now);
            const result = apply(room, now);
            reconcile(room, now);
            const data = room.seats.length > 0 ? JSON.stringify(room) : null;
            if (data === current || await this.store.writePeerRoom(this.boardId, current, data, 2 * peerRoomLimits.leaseMs)) {
                return result;
            }
        }
        throw new RoomFailure(503, "The Live room is busy. Retrying…");
    }
}

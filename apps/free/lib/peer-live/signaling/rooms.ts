import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
    roomLimits, type ExchangeRequest, type HostExchange, type HostGrant, type HostUpdate,
    type JoinRequest, type ParticipantExchange, type ParticipantGrant, type RoomAction, type RoomGrant, type RoomSeat,
} from "./protocol";
import type { RoomStore } from "./store";

type StoredSeat = RoomSeat & { tokenHash: string; expiresAt: number | null };
type Room = RoomGrant & {
    hostTokenHash: string;
    inviteHash: string;
    endsAt: number;
    seats: StoredSeat[];
};

export class RoomError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
    }
}

const unavailable = () => new RoomError(410, "room_unavailable", "The host's room is closed or has expired.");
const forbidden = () => new RoomError(403, "forbidden", "This invitation or seat is no longer valid.");
const limited = () => new RoomError(429, "rate_limited", "Too many requests. Try again in a moment.");
const token = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const matches = (value: string, expectedHash: string) =>
    timingSafeEqual(Buffer.from(hash(value)), Buffer.from(expectedHash));
const roomKey = (id: string) => `meldrift:peer-live:room:${id}`;

function grantOf(room: Room): RoomGrant {
    const { roomId, epoch, hostId, hostName, leaseExpiresAt } = room;
    return { roomId, epoch, hostId, hostName, leaseExpiresAt };
}

function participantGrant(room: Room, seat: StoredSeat): ParticipantGrant {
    return { ...grantOf(room), participantId: seat.participantId, attemptId: seat.attemptId };
}

function hostSeatOf(seat: StoredSeat): RoomSeat {
    const { participantId, attemptId, name, state, role, answer } = seat;
    return { participantId, attemptId, name, state, role, answer };
}

function updateSeat(seat: StoredSeat, state: RoomSeat["state"], expiresAt: number | null) {
    seat.state = state;
    seat.expiresAt = expiresAt;
    delete seat.offer;
    delete seat.answer;
}

function handleHostUpdate(room: Room, update: HostUpdate, now: number) {
    const seat = room.seats.find(({ participantId, attemptId }) =>
        participantId === update.participantId && attemptId === update.attemptId);
    if (!seat) {
        return;
    }

    switch (update.kind) {
        case "approve":
            if (seat.state === "pending") {
                seat.role = update.role;
                updateSeat(seat, "negotiating", now + roomLimits.negotiationMs);
            }
            break;
        case "offer":
            if (seat.state === "negotiating" && !seat.offer) {
                seat.offer = update.sdp;
            }
            break;
        case "connected":
            if (seat.state === "negotiating" && seat.answer) {
                updateSeat(seat, "connected", null);
            }
            break;
        case "disconnected":
            if (seat.state === "connected" || seat.state === "negotiating") {
                updateSeat(seat, "reconnecting", now + roomLimits.reconnectMs);
            }
            break;
        case "deny":
            if (seat.state === "pending") {
                updateSeat(seat, "denied", now + 15_000);
            }
            break;
    }
}

export class PeerRooms {
    constructor(private readonly store: RoomStore, private readonly now = Date.now) {}

    async throttle(action: "create" | "join" | "exchange" | "manage", address: string, roomId = "") {
        const key = `meldrift:peer-live:rate:${action}:${hash(`${address}:${roomId}`)}`;
        const limits = { create: 12, join: 40, exchange: 600, manage: 30 };
        if (await this.store.increment(key, 60_000) > limits[action]) {
            throw limited();
        }
    }

    async create(name: string): Promise<HostGrant> {
        const now = this.now();
        const hostToken = token();
        const inviteSecret = token();
        const room: Room = {
            roomId: randomUUID(), epoch: randomUUID(), hostId: randomUUID(), hostName: name,
            hostTokenHash: hash(hostToken), inviteHash: hash(inviteSecret), seats: [],
            leaseExpiresAt: now + roomLimits.leaseMs, endsAt: now + roomLimits.lifetimeMs,
        };
        const saved = await this.store.compareAndSet(roomKey(room.roomId), null, {
            data: JSON.stringify(room), expiresAt: room.leaseExpiresAt,
        });
        if (!saved) {
            throw new Error("The room could not be created.");
        }
        return { ...grantOf(room), hostToken, inviteSecret };
    }

    async join(id: string, credential: string, request: JoinRequest) {
        return this.update(id, (room, now) => {
            if (request.kind === "resume") {
                const seat = this.participant(room, credential);
                if (seat.state === "denied" || seat.state === "pending") {
                    throw forbidden();
                }
                if (seat.attemptId === request.attemptId) {
                    seat.attemptId = randomUUID();
                    updateSeat(seat, "negotiating", now + roomLimits.negotiationMs);
                }
                return participantGrant(room, seat);
            }

            if (!matches(credential, room.inviteHash)) {
                throw forbidden();
            }
            const previous = room.seats.find((seat) => matches(request.participantToken, seat.tokenHash));
            if (previous) {
                return participantGrant(room, previous);
            }

            const reserved = room.seats.filter((seat) => seat.state !== "denied").length;
            if (reserved >= roomLimits.participants) {
                throw new RoomError(409, "room_full", "This room already has eight people, including the host.");
            }
            const seat: StoredSeat = {
                participantId: randomUUID(), attemptId: randomUUID(), name: request.name, state: "pending",
                tokenHash: hash(request.participantToken), expiresAt: now + roomLimits.approvalMs,
            };
            room.seats.push(seat);
            return participantGrant(room, seat);
        });
    }

    async exchange(id: string, credential: string, request: ExchangeRequest): Promise<HostExchange | ParticipantExchange> {
        return this.update<HostExchange | ParticipantExchange>(id, (room, now) => {
            if (request.kind === "host") {
                this.requireHost(room, credential);
                for (const update of request.updates) {
                    handleHostUpdate(room, update, now);
                }
                room.leaseExpiresAt = Math.min(now + roomLimits.leaseMs, room.endsAt);
                const seats = room.seats.filter((seat) => seat.state !== "denied").map(hostSeatOf);
                return { leaseExpiresAt: room.leaseExpiresAt, seats };
            }

            const seat = this.participant(room, credential);
            if (seat.attemptId !== request.attemptId) {
                throw new RoomError(409, "superseded", "This seat is open in another connection.");
            }
            if (request.leave) {
                room.seats = room.seats.filter((candidate) => candidate !== seat);
                return { state: "denied" };
            }
            if (request.answer && seat.offer && seat.state === "negotiating" && !seat.answer) {
                seat.answer = request.answer;
            }
            return { state: seat.state, role: seat.role, offer: seat.offer };
        });
    }

    async manage(id: string, credential: string, action: RoomAction) {
        return this.update(id, (room, now) => {
            this.requireHost(room, credential);
            if (action.kind === "rotate") {
                const inviteSecret = token();
                room.inviteHash = hash(inviteSecret);
                for (const seat of room.seats) {
                    if (seat.state === "pending") {
                        updateSeat(seat, "denied", now + 15_000);
                    }
                }
                return { inviteSecret };
            }
            const seat = room.seats.find(({ participantId }) => participantId === action.participantId);
            if (seat) {
                updateSeat(seat, "denied", now + 15_000);
            }
            return {};
        });
    }

    async close(id: string, credential: string) {
        return this.update(id, (room) => {
            this.requireHost(room, credential);
            return {};
        }, true);
    }

    private requireHost(room: Room, credential: string) {
        if (!matches(credential, room.hostTokenHash)) {
            throw forbidden();
        }
    }

    private participant(room: Room, credential: string) {
        const seat = room.seats.find(({ tokenHash }) => matches(credential, tokenHash));
        if (!seat) {
            throw forbidden();
        }
        return seat;
    }

    private async update<T>(id: string, apply: (room: Room, now: number) => T, remove = false): Promise<T> {
        const key = roomKey(id);
        for (let retry = 0; retry < 10; retry++) {
            const current = await this.store.read(key);
            if (!current) {
                throw unavailable();
            }
            const room = JSON.parse(current) as Room;
            const now = this.now();
            if (room.leaseExpiresAt <= now || room.endsAt <= now) {
                throw unavailable();
            }
            room.seats = room.seats.filter(({ expiresAt }) => expiresAt === null || expiresAt > now);

            const result = apply(room, now);
            const data = JSON.stringify(room);
            if (!remove && data === current) {
                return result;
            }
            const next = remove ? null : { data, expiresAt: room.leaseExpiresAt };
            if (await this.store.compareAndSet(key, current, next)) {
                return result;
            }
        }
        throw new RoomError(503, "room_busy", "The room is busy. Try again in a moment.");
    }
}

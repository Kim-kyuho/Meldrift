import { liveHeadKey } from "../commit-events";
import { holderOf, liveLimits, maskEmail, type LiveLock, type LockIntent } from "../protocol";
import type { LiveStore } from "../store";
import type { StoredLock } from "../store/types";
import type { LockReply, RoomStatus, RoomView } from "./protocol";
import { RoomFailure, type RoomSeat } from "./rooms";

const holder = (seat: RoomSeat) => holderOf(seat.userId, seat.clientId);

function readableLock(lock: StoredLock, userId: number, seesEmails: boolean): LiveLock {
    const { key, holder, clientId, email, intent, color } = lock;
    return { key, holder, clientId, userId: lock.userId, email: seesEmails || lock.userId === userId ? email : maskEmail(email), intent, color };
}

async function readableLocks(store: LiveStore, boardId: number, userId: number, seesEmails: boolean) {
    return (await store.locks(boardId)).map((lock) => readableLock(lock, userId, seesEmails));
}

export async function roomStatus(store: LiveStore, boardId: number, view: RoomView, seesEmails: boolean): Promise<RoomStatus> {
    const [locks, head] = await Promise.all([
        readableLocks(store, boardId, view.self.userId, seesEmails), store.keyRevision(boardId, [liveHeadKey]),
    ]);
    return { ...view, locks, head };
}

export async function acquireLiveLocks(store: LiveStore, boardId: number, seat: RoomSeat, keys: string[], intent: LockIntent): Promise<LockReply> {
    if (seat.role !== "editor") {
        throw new RoomFailure(403, "This seat can only view the board.");
    }
    const actor = {
        key: "", holder: holder(seat), clientId: seat.clientId, userId: seat.userId, email: seat.email, intent, color: seat.color,
    };
    const result = await store.acquire(boardId, actor, [...new Set(keys)], liveLimits.lockTtlMs);
    if (!result.granted) {
        return { granted: false, conflict: result.conflict && readableLock(result.conflict, seat.userId, seat.seesEmails) };
    }
    return { granted: true, keyRevision: await store.keyRevision(boardId, keys) };
}

export function releaseLiveLocks(store: LiveStore, boardId: number, seat: RoomSeat, keys: string[]) {
    return store.release(boardId, holder(seat), keys);
}

export async function renewLiveLocks(store: LiveStore, boardId: number, seat: RoomSeat) {
    if (seat.role === "editor") {
        await store.renew(boardId, [holder(seat)], liveLimits.lockTtlMs);
    }
}

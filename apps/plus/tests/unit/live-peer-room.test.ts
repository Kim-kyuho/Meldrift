import { describe, expect, it } from "vitest";
import { MemoryLiveStore } from "@/lib/live/store/memory-store";
import { PeerRooms, type RoomSeat } from "@/lib/live/p2p/rooms";
import { peerRoomLimits } from "@/lib/live/p2p/protocol";

function member(userId: number, role: RoomSeat["role"] = "editor", seesEmails = true): RoomSeat {
    return {
        userId, clientId: crypto.randomUUID(), leaseId: crypto.randomUUID(),
        role, color: "#123456", email: "member" + userId + "@example.test",
        seesEmails, joinedAt: 0, expiresAt: peerRoomLimits.leaseMs,
    };
}

const sdp = "m=application 9 UDP/DTLS/SCTP webrtc-datachannel";

describe("Plus peer room", () => {
    it("reserves at most eight seats across concurrent joins", async () => {
        const rooms = new PeerRooms(new MemoryLiveStore(() => 0), 1, () => 0);
        const owner = member(1);
        const first = await rooms.join(owner);
        const admissions = await Promise.allSettled(Array.from({ length: 9 }, (_, index) => rooms.join(member(index + 2))));
        expect(admissions.filter(({ status }) => status === "fulfilled")).toHaveLength(7);
        expect(admissions.flatMap((result) => result.status === "rejected" ? [result.reason.status] : [])).toEqual([409, 409]);
        const { view } = await rooms.pulse(owner, owner.expiresAt, first.epoch, []);
        expect(view.negotiations).toHaveLength(7);
        expect(view.hostId).toBe(owner.clientId);
    });

    it("isolates signaling to the elected host and guest and masks email for public viewers", async () => {
        const rooms = new PeerRooms(new MemoryLiveStore(() => 0), 1, () => 0);
        const host = member(1);
        const guest = member(2, "viewer", false);
        const other = member(3);
        const { epoch } = await rooms.join(host);
        const { negotiations, peers } = await rooms.join(guest);
        await rooms.join(other);
        const [{ attemptId, guestId }] = negotiations;
        expect(peers.find(({ clientId }) => clientId === host.clientId)?.email).toBe("m***@example.test");
        await rooms.pulse(other, 60_000, epoch, [{ kind: "offer", guestId, attemptId, sdp }]);
        const unoffered = await rooms.pulse(guest, 60_000, epoch, []);
        expect(unoffered.view.negotiations[0].offer).toBeUndefined();

        await rooms.pulse(host, 60_000, epoch, [{ kind: "offer", guestId, attemptId, sdp }]);
        const offered = await rooms.pulse(guest, 60_000, epoch, [{ kind: "answer", guestId, attemptId, sdp }]);
        expect(offered.view.negotiations[0]).toMatchObject({ offer: sdp, answer: undefined });
        const otherView = await rooms.pulse(other, 60_000, epoch, []);
        expect(otherView.view.negotiations.map((link) => link.offer)).toEqual([undefined]);

        const connected = await rooms.pulse(host, 60_000, epoch, [{ kind: "connected", guestId, attemptId }]);
        expect(connected.view.negotiations.find((link) => link.guestId === guestId)).toMatchObject({
            connected: true, offer: undefined, answer: undefined,
        });
        expect(connected.view.peers.map(({ clientId }) => clientId)).toContain(guestId);
    });

    it("elects the next editor on departure and fences signaling from the old host", async () => {
        const rooms = new PeerRooms(new MemoryLiveStore(() => 0), 1, () => 0);
        const viewer = member(1, "viewer");
        const firstEditor = member(2);
        const secondEditor = member(3);
        expect((await rooms.join(viewer)).hostId).toBeNull();
        const first = await rooms.join(firstEditor);
        await rooms.join(secondEditor);
        expect(await rooms.leave(firstEditor)).toBe(true);

        await expect(rooms.pulse(firstEditor, 60_000, first.epoch, [])).rejects.toMatchObject({ status: 410 });
        const { view } = await rooms.pulse(secondEditor, 60_000, first.epoch, []);
        expect(view.hostId).toBe(secondEditor.clientId);
        expect(view.epoch).not.toBe(first.epoch);
    });

    it("expires a stopped host and retains another editor's refreshed seat", async () => {
        let now = 0;
        const rooms = new PeerRooms(new MemoryLiveStore(() => now), 1, () => now);
        const host = member(1);
        const remaining = member(2);
        const { epoch } = await rooms.join(host);
        await rooms.join(remaining);
        now = peerRoomLimits.leaseMs - 1;
        await rooms.pulse(remaining, 60_000, epoch, []);

        now += 2;
        const { view } = await rooms.pulse(remaining, 60_000, epoch, []);
        expect(view.hostId).toBe(remaining.clientId);
        expect(view.peers.map(({ clientId }) => clientId)).toEqual([remaining.clientId]);
    });

    it("keeps a refreshed seat and ignores a leave for its previous connection", async () => {
        const rooms = new PeerRooms(new MemoryLiveStore(() => 0), 1, () => 0);
        const previous = member(1);
        const first = await rooms.join(previous);
        const next = { ...previous, leaseId: crypto.randomUUID() };
        const rejoined = await rooms.join(next);
        expect(rejoined.epoch).not.toBe(first.epoch);
        expect(await rooms.leave(previous)).toBe(false);
        expect((await rooms.seat(next)).leaseId).toBe(next.leaseId);
    });
});

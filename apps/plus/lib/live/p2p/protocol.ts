import { directDescriptionLimit, isDirectDataDescription } from "@meldrift/core/direct-webrtc";
import { z } from "zod";
import { isObjectKey, liveLimits, transientSchema, type LiveLock, type LivePeer } from "../protocol";

export const peerRoomLimits = {
    seats: 8,
    leaseMs: 25_000,
    negotiationMs: 25_000,
    pulseMs: 5_000,
    bodyBytes: 64 * 1024,
} as const;

const id = z.string().uuid();
const keys = z.array(z.string().max(200).refine(isObjectKey)).min(1).max(liveLimits.keysPerRequest);
const sdp = z.string().max(directDescriptionLimit).refine(isDirectDataDescription);
const signalTarget = { guestId: id, attemptId: id };
const signal = z.discriminatedUnion("kind", [
    z.object({ ...signalTarget, kind: z.literal("offer"), sdp }).strict(),
    z.object({ ...signalTarget, kind: z.literal("answer"), sdp }).strict(),
    z.object({ ...signalTarget, kind: z.literal("connected") }).strict(),
    z.object({ ...signalTarget, kind: z.literal("retry") }).strict(),
]);

export const joinPeerRoomSchema = z.object({ clientId: id, leaseId: id }).strict();
export const roomRequestSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("pulse"), epoch: id, signals: z.array(signal).max(8), holding: z.boolean() }).strict(),
    z.object({ kind: z.literal("acquire"), keys, intent: z.enum(["edit", "move"]) }).strict(),
    z.object({ kind: z.literal("release"), keys }).strict(),
    z.object({ kind: z.literal("leave") }).strict(),
]);

export type PeerSignal = z.infer<typeof signal>;
export type RoomRequest = z.infer<typeof roomRequestSchema>;

export type Negotiation = {
    guestId: string;
    attemptId: string;
    connected: boolean;
    offer?: string;
    answer?: string;
};

export type RoomView = {
    epoch: string;
    hostId: string | null;
    self: LivePeer;
    peers: LivePeer[];
    negotiations: Negotiation[];
};

export type RoomStatus = RoomView & { locks: LiveLock[]; head: number };
export type RoomGrant = { token: string; expiresAt: number; status: RoomStatus };
export type LockReply = { granted: true; keyRevision: number } | { granted: false; conflict: LiveLock | null };

const coordinate = z.number().finite().min(-100_000).max(100_000);
const cursor = z.object({ x: coordinate, y: coordinate }).strict().nullable();
export const peerEventSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("cursor"), point: cursor }).strict(),
    z.object({ kind: z.literal("transient"), items: z.array(transientSchema).max(liveLimits.transientsPerMessage) }).strict(),
    z.object({ kind: z.literal("refresh") }).strict(),
]);
export const peerFrameSchema = z.object({ event: peerEventSchema, from: id.optional() }).strict();
export type PeerEvent = z.infer<typeof peerEventSchema>;
export type PeerFrame = z.infer<typeof peerFrameSchema>;

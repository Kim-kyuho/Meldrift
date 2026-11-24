import { z } from "zod";
import { directDescriptionLimit, isDirectDataDescription } from "@meldrift/core/direct-webrtc";

export const roomLimits = {
    participants: 7,
    approvalMs: 60_000,
    negotiationMs: 25_000,
    reconnectMs: 30_000,
    leaseMs: 90_000,
    lifetimeMs: 8 * 60 * 60_000,
    bodyBytes: 64 * 1024,
};

export const roomIdSchema = z.string().uuid();
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const displayNameSchema = z.string().trim().min(1).max(32);
export const roomRoleSchema = z.enum(["editor", "viewer"]);
export type RoomRole = z.infer<typeof roomRoleSchema>;

// Each side gathers candidates before sending SDP. Only the data transport is negotiated.
export const descriptionSchema = z.string().max(directDescriptionLimit)
    .refine(isDirectDataDescription, "Only direct WebRTC data channels are supported.");

export const createRoomSchema = z.object({ name: displayNameSchema }).strict();
export const joinRoomSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("join"), name: displayNameSchema, participantToken: tokenSchema }).strict(),
    z.object({ kind: z.literal("resume"), attemptId: roomIdSchema }).strict(),
]);

const attempt = { participantId: roomIdSchema, attemptId: roomIdSchema };
export const hostUpdateSchema = z.discriminatedUnion("kind", [
    z.object({ ...attempt, kind: z.literal("approve"), role: roomRoleSchema }).strict(),
    z.object({ ...attempt, kind: z.literal("offer"), sdp: descriptionSchema }).strict(),
    z.object({ ...attempt, kind: z.literal("connected") }).strict(),
    z.object({ ...attempt, kind: z.literal("disconnected") }).strict(),
    z.object({ ...attempt, kind: z.literal("deny") }).strict(),
]);
export const exchangeSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("host"), updates: z.array(hostUpdateSchema).max(32) }).strict(),
    z.object({ kind: z.literal("participant"), attemptId: roomIdSchema, answer: descriptionSchema.optional(), leave: z.literal(true).optional() }).strict(),
]);
export const roomActionSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("rotate") }).strict(),
    z.object({ kind: z.literal("remove"), participantId: roomIdSchema }).strict(),
]);

export type HostUpdate = z.infer<typeof hostUpdateSchema>;
export type ExchangeRequest = z.infer<typeof exchangeSchema>;
export type JoinRequest = z.infer<typeof joinRoomSchema>;
export type RoomAction = z.infer<typeof roomActionSchema>;

export type RoomGrant = {
    roomId: string;
    epoch: string;
    hostId: string;
    hostName: string;
    leaseExpiresAt: number;
};

export type HostGrant = RoomGrant & { hostToken: string; inviteSecret: string };
export type ParticipantGrant = RoomGrant & { participantId: string; attemptId: string };

type SeatState = "pending" | "negotiating" | "connected" | "reconnecting" | "denied";
export type RoomSeat = {
    participantId: string;
    attemptId: string;
    name: string;
    state: SeatState;
    role?: RoomRole;
    offer?: string;
    answer?: string;
};

export type HostExchange = { leaseExpiresAt: number; seats: RoomSeat[] };
export type ParticipantExchange = { state: SeatState; role?: RoomRole; offer?: string };

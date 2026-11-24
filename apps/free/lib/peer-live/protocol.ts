import { z } from "zod";
import { displayNameSchema, roomIdSchema, roomRoleSchema } from "./signaling/protocol";

export const peerProtocolVersion = 1;
export const colors = ["#e11d48", "#ea580c", "#b45309", "#15803d", "#0e7490", "#2563eb", "#7c3aed", "#c026d3"];

const sequence = z.number().int().nonnegative().safe();
const lockKey = z.string().regex(/^(?:board:\*|order:memo|layer:strokes|(?:memo|image|table|mermaid|stroke):[A-Za-z0-9:_-]{1,200})$/);
const keys = z.array(lockKey).min(1).max(200);
const intent = z.enum(["edit", "move"]);

export const peerSchema = z.object({
    id: roomIdSchema, name: displayNameSchema, role: roomRoleSchema, color: z.string().regex(/^#[0-9a-f]{6}$/),
});
export type Peer = z.infer<typeof peerSchema>;

const lockSchema = z.object({ key: lockKey, owner: roomIdSchema, intent });
export const participantControl = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("hello"), version: z.literal(peerProtocolVersion), epoch: roomIdSchema, attemptId: roomIdSchema }),
    z.object({ kind: z.literal("synced"), revision: sequence }),
    z.object({ kind: z.literal("acquire"), id: roomIdSchema, keys, intent }),
    z.object({ kind: z.literal("release"), keys }),
]);

const lockOutcome = z.discriminatedUnion("granted", [
    z.object({ granted: z.literal(true), revision: sequence }),
    z.object({ granted: z.literal(false), owner: roomIdSchema.nullable() }),
]);
export type LockOutcome = z.infer<typeof lockOutcome>;

export const hostControl = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("state"), peers: z.array(peerSchema).max(8), locks: z.array(lockSchema).max(1600) }),
    z.object({ kind: z.literal("lock"), id: roomIdSchema, outcome: lockOutcome }),
    z.object({ kind: z.literal("rejected"), mutationId: roomIdSchema, message: z.string().max(300) }),
    z.object({ kind: z.literal("ended"), message: z.string().max(300) }),
]);

const coordinate = z.number().finite().min(-100_000).max(100_000);
const point = z.object({ x: coordinate, y: coordinate });
const transient = point.extend({ key: lockKey, width: coordinate.positive(), height: coordinate.positive() });
export const presenceFrame = z.object({ sequence, cursor: point.nullable(), transients: z.array(transient).max(50) });
export const peerPresenceFrame = presenceFrame.extend({ peerId: roomIdSchema });
export type PresenceFrame = z.infer<typeof presenceFrame>;

import { z } from "zod";
import { specialLockKeys, type BoardOperation } from "@meldrift/board-data/board-delta";

export const liveProtocolVersion = 1;

export const liveCloseCodes = {
    rotated: 4000,
    badRequest: 4400,
    unauthenticated: 4401,
    forbidden: 4403,
    missing: 4404,
    timeout: 4408,
    rateLimited: 4429,
} as const;

export const liveLimits = {
    messageBytes: 16 * 1024,
    keysPerRequest: 200,
    transientsPerMessage: 50,
    lockTtlMs: 20_000,
    presenceStaleMs: 30_000,
    heartbeatMs: 5_000,
    sweepMs: 10_000,
    pingMs: 15_000,
    pongTimeoutMs: 35_000,
    helloTimeoutMs: 5_000,
    frameMs: 50,
    revalidateMs: 60_000,
    rotateLeadMs: 30_000,
    inlineCommitBytes: 32 * 1024,
    // 입력이 이만큼 없으면 클라이언트가 연결을 끊는다. 연결 시간만큼 서버 비용이 든다.
    idleDisconnectMs: 10 * 60_000,
} as const;

export type LockIntent = "move" | "edit";
export type LiveRole = "editor" | "viewer" | "guest";

const objectKeyPattern = /^(memo|image|mermaid|table|stroke):[A-Za-z0-9:_-]{1,160}$/;

export const isObjectKey = (key: string) =>
    (specialLockKeys as readonly string[]).includes(key) || objectKeyPattern.test(key);

const objectKey = z.string().max(200).refine(isObjectKey);
const keyList = z.array(objectKey).min(1).max(liveLimits.keysPerRequest);
const coordinate = z.number().finite().min(-100_000).max(100_000);
const size = z.number().finite().positive().max(100_000);

export const transientSchema = z.object({ key: objectKey, x: coordinate, y: coordinate, width: size, height: size });

export const clientMessageSchema = z.discriminatedUnion("t", [
    z.object({
        t: z.literal("hello"),
        v: z.literal(liveProtocolVersion),
        clientId: z.string().uuid(),
        held: z.array(objectKey).max(liveLimits.keysPerRequest),
        revision: z.number().int().min(0),
    }),
    z.object({ t: z.literal("pong") }),
    z.object({
        t: z.literal("cursor"),
        x: coordinate.optional(),
        y: coordinate.optional(),
        hidden: z.literal(true).optional(),
    }),
    z.object({
        t: z.literal("lock.acquire"),
        reqId: z.number().int().min(0),
        keys: keyList,
        intent: z.enum(["move", "edit"]),
    }),
    z.object({ t: z.literal("lock.release"), keys: keyList }),
    z.object({ t: z.literal("transient"), items: z.array(transientSchema).max(liveLimits.transientsPerMessage) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type LiveTransientInput = z.infer<typeof transientSchema>;

export type LivePeer = {
    clientId: string;
    userId: number | null;
    email: string | null;
    role: LiveRole;
    color: string;
    joinedAt: number;
};

export type LiveLock = {
    key: string;
    holder: string;
    clientId: string;
    userId: number;
    email: string | null;
    intent: LockIntent;
    color: string;
};

export type LiveCursor = { clientId: string; x: number; y: number } | { clientId: string; hidden: true };
export type LiveTransient = LiveTransientInput & { clientId: string };

export type CommitAuthor = { userId: number; email: string | null; clientId: string | null };

export type LiveCommit = {
    revision: number;
    mutationId: string;
    by: CommitAuthor;
    operations: BoardOperation[] | null;
};

export type ServerMessage =
    | {
        t: "welcome";
        connId: string;
        self: LivePeer;
        peers: LivePeer[];
        locks: LiveLock[];
        head: number;
        rotateAt: number;
        canEdit: boolean;
    }
    | { t: "presence.join"; peer: LivePeer }
    | { t: "presence.leave"; clientId: string }
    | { t: "frame"; cursors: LiveCursor[]; transients: LiveTransient[] }
    | { t: "lock.result"; reqId: number; granted: true; keyRevision: number }
    | { t: "lock.result"; reqId: number; granted: false; conflict: LiveLock | null }
    | { t: "lock.acquired"; locks: LiveLock[] }
    | { t: "lock.released"; clientId: string; keys: string[] }
    | { t: "lock.lost"; keys: string[] }
    | ({ t: "commit" } & LiveCommit)
    | { t: "ping" }
    | { t: "rotate" };

// 인스턴스 사이에 pub/sub로 오가는 사건. 받는 소켓의 권한에 맞춰 ServerMessage로 바꿔 보낸다.
export type BoardEvent =
    | { t: "presence.join"; peer: LivePeer }
    | { t: "presence.leave"; clientId: string }
    | { t: "frame"; cursors: LiveCursor[]; transients: LiveTransient[] }
    | { t: "lock.acquired"; locks: LiveLock[] }
    | { t: "lock.released"; clientId: string; keys: string[] }
    | ({ t: "commit" } & LiveCommit);

export const holderOf = (userId: number, clientId: string) => `${userId}:${clientId}`;

const peerColors = ["#e11d48", "#ea580c", "#b45309", "#15803d", "#0e7490", "#2563eb", "#7c3aed", "#c026d3"];

export function colorFor(seed: string) {
    let hash = 0;
    for (const character of seed) {
        hash = (hash * 31 + character.charCodeAt(0)) | 0;
    }
    return peerColors[Math.abs(hash) % peerColors.length];
}

export function maskEmail(email: string | null) {
    if (!email) {
        return null;
    }
    const at = email.indexOf("@");
    if (at < 1) {
        return "***";
    }
    return `${email[0]}***${email.slice(at)}`;
}

export const emailLocalPart = (email: string | null) => email ? email.split("@")[0] : "Guest";

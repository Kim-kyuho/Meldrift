import { z } from "zod";
import { specialLockKeys, type BoardOperation } from "@meldrift/board-data/board-delta";

export const liveLimits = {
    messageBytes: 16 * 1024,
    keysPerRequest: 200,
    transientsPerMessage: 50,
    lockTtlMs: 20_000,
    heartbeatMs: 5_000,
    frameMs: 50,
    // Inactive tabs release their seat and stop polling.
    idleDisconnectMs: 10 * 60_000,
} as const;

export type LockIntent = "move" | "edit";
export type LiveRole = "editor" | "viewer";

const objectKeyPattern = /^(memo|image|mermaid|table|stroke):[A-Za-z0-9:_-]{1,160}$/;

export const isObjectKey = (key: string) =>
    (specialLockKeys as readonly string[]).includes(key) || objectKeyPattern.test(key);

const objectKey = z.string().max(200).refine(isObjectKey);
const coordinate = z.number().finite().min(-100_000).max(100_000);
const size = z.number().finite().positive().max(100_000);

export const transientSchema = z.object({ key: objectKey, x: coordinate, y: coordinate, width: size, height: size });

export type LiveTransientInput = z.infer<typeof transientSchema>;

export type LivePeer = {
    clientId: string;
    userId: number;
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

export type LiveTransient = LiveTransientInput & { clientId: string };

export type CommitAuthor = { userId: number; email: string | null; clientId: string | null };

export type LiveCommit = {
    revision: number;
    mutationId: string;
    by: CommitAuthor;
    operations: BoardOperation[];
};

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

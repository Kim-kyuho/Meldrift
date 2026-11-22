import { sql } from "drizzle-orm";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import type { NextRequest } from "next/server";

export const requestSessionHash = (request: NextRequest) => getSessionTokenHash(request.cookies.get(sessionCookieName)?.value);

// Account changes and board creation share this transaction lock to prevent email reuse races.
export const membershipLock = sql`SELECT pg_advisory_xact_lock(741921, 1)`;

export const activeMember = (userId: number, sessionHash: string | null) => sql`
    id = ${userId} AND session_token_hash = ${sessionHash} AND session_expires_at > now()`;

export const activeAdministrator = (userId: number, sessionHash: string | null) => sql`
    EXISTS (SELECT 1 FROM users WHERE ${activeMember(userId, sessionHash)} AND role = 'admin')`;

export const emailIsAvailable = (email: string) => sql`
    NOT EXISTS (SELECT 1 FROM boards WHERE owner_id = ${email})`;

import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { db_users } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

async function findSessionUser(token: string | undefined) {
    try {
        const sessionTokenHash = getSessionTokenHash(token);

        if (!sessionTokenHash) {
            return null;
        }

        const db = getDb();
        const users = await db
            .select({
                id: db_users.id,
                email: db_users.email,
                isApproved: db_users.isApproved,
                role: db_users.role,
            })
            .from(db_users)
            .where(
                and(
                    eq(db_users.sessionTokenHash, sessionTokenHash),
                    gt(db_users.sessionExpiresAt, new Date()),
                ),
            )
            .limit(1);

        return users[0] ?? null;
    } catch (error) {
        console.error("Error fetching current user:", error);
        throw error;
    }
}

export function getCurrentUserFromRequest(request: Request) {
    const requestCookies = (request as NextRequest).cookies
        ?? new NextRequest(request.url, { headers: request.headers }).cookies;
    return findSessionUser(requestCookies.get(sessionCookieName)?.value);
}

export const getCurrentUser = async () => findSessionUser((await cookies()).get(sessionCookieName)?.value);

export type SessionUser = NonNullable<Awaited<ReturnType<typeof findSessionUser>>>;

export function getCardPermissionMessage(
    user: Awaited<ReturnType<typeof getCurrentUserFromRequest>>
) {
    if (!user) {
        return "Please sign in before editing cards.";
    }
    if (!user.isApproved) {
        return "Your account is waiting for administrator approval.";
    }

    return null;
}

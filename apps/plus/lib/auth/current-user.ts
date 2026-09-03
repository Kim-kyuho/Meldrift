import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { db_users } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { NextRequest } from "next/server";

export async function getCurrentUserFromRequest(request: NextRequest) {
    try {
        const sessionTokenHash = getSessionTokenHash(
            request.cookies.get(sessionCookieName)?.value
        );

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

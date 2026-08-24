import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { db_users } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { NextRequest } from "next/server";

// 현재 유저정보 GET 위한 라이브러리
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

// 카드 편집 권한 메시지
export function getCardPermissionMessage(
    user: Awaited<ReturnType<typeof getCurrentUserFromRequest>>
) {
    // Sign in을 하지 않았을 경우 출력 메시지
    if (!user) {
        return "Please sign in before editing cards.";
    }
    // Sign up 후 허가되지 않은 유저의 경우 출력 메시지
    if (!user.isApproved) {
        return "Your account is waiting for administrator approval.";
    }

    return null;
}

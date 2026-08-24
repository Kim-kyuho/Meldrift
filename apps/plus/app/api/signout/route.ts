import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { db_users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const sessionTokenHash = getSessionTokenHash(
            request.cookies.get(sessionCookieName)?.value,
        );

        if (sessionTokenHash) {
            const db = getDb();
            await db
                .update(db_users)
                .set({
                    sessionTokenHash: null,
                    sessionExpiresAt: null,
                    updatedAt: new Date(),
                })
                .where(eq(db_users.sessionTokenHash, sessionTokenHash));
        }

        const response = NextResponse.json(
            {
                ok: true,
            },
            { status: 200 },
        );
        response.cookies.delete(sessionCookieName);

        return response;
    } catch (error) {
        console.error("Error signing out:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while signing out.",
            },
            { status: 500 },
        );
    }
}

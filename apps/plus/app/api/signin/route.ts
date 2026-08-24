import { verifyPassword } from "@/lib/auth/password";
import {
    createSessionExpiresAt,
    createSessionToken,
    hashSessionToken,
    sessionCookieName,
    sessionMaxAgeSeconds,
} from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { db_users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const db = getDb();
        const body = await request.json();
        const email = String(body.email ?? "").trim();
        const password = String(body.password ?? "");

        if (!email || !password) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Please enter your email and password.",
                },
                { status: 400 },
            );
        }

        const users = await db
            .select({
                id: db_users.id,
                email: db_users.email,
                passwordHash: db_users.passwordHash,
                isApproved: db_users.isApproved,
                role: db_users.role,
            })
            .from(db_users)
            .where(eq(db_users.email, email))
            .limit(1);
        const user = users[0];

        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Email or password is incorrect.",
                },
                { status: 401 },
            );
        }

        const sessionToken = createSessionToken();
        const sessionExpiresAt = createSessionExpiresAt();

        await db
            .update(db_users)
            .set({
                sessionTokenHash: hashSessionToken(sessionToken),
                sessionExpiresAt,
                updatedAt: new Date(),
            })
            .where(eq(db_users.id, user.id));

        const response = NextResponse.json(
            {
                ok: true,
                user: {
                    email: user.email,
                    isApproved: user.isApproved,
                    role: user.role,
                },
            },
            { status: 200 },
        );

        response.cookies.set(sessionCookieName, sessionToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: sessionMaxAgeSeconds,
        });

        return response;
    } catch (error) {
        console.error("Error during sign-in:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred during sign-in.",
            },
            { status: 500 },
        );
    }
}

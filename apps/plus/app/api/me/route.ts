import { getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { sessionCookieName } from "@/lib/auth/session";
import { BoardPrivacyError } from "@/lib/board-privacy";
import { deleteMemberAccounts } from "@/lib/member-deletion";
import { activeMember, requestSessionHash } from "@/lib/membership-guard";
import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);

        if (!currentUser) {
            return NextResponse.json(
                {
                    user: null,
                },
                { status: 200 },
            );
        }

        return NextResponse.json(
            {
                user: {
                    email: currentUser.email,
                    isApproved: currentUser.isApproved,
                    role: currentUser.role,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error fetching current user:", error);
        return NextResponse.json(
            {
                ok: false,
                message: "An error occurred while fetching the current user.",
            },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest) {
    const json = (data: object, status = 200) =>
        NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return json({ ok: false, message: "Please sign in first." }, 401);
        }
        const authorized = sql`EXISTS (
            SELECT 1 FROM users WHERE ${activeMember(user.id, requestSessionHash(request))}
                AND (role <> 'admin' OR EXISTS (
                    SELECT 1 FROM users AS other_admin
                    WHERE other_admin.role = 'admin' AND other_admin.id <> ${user.id}
                ))
        )`;
        const retainedBoards = await deleteMemberAccounts([user.id], authorized);
        if (retainedBoards === null) {
            const message = user.role === "admin"
                ? "Check your session. The last administrator must appoint another administrator before leaving."
                : "Your session changed. Please sign in again.";
            return json({ ok: false, message }, 409);
        }
        const response = json({ ok: true });
        response.cookies.delete(sessionCookieName);
        console.info("member.withdrew", { member: user.id, retainedBoards });
        return response;
    } catch (error) {
        if (error instanceof BoardPrivacyError) {
            return json({ ok: false, message: error.message }, 503);
        }
        console.error("Error deleting own account:", error);
        return json({ ok: false, message: "Your account could not be deleted." }, 500);
    }
}

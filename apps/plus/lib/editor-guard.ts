import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";

export type EditorIdentity = {
    userId: number;
    sessionHash: string | null;
};

// One account holds one live session: signing in elsewhere replaces the hash and the older device
// stops matching here. The board itself is not locked — cards commit one object at a time.
export const editorSessionGuard = ({ userId, sessionHash }: EditorIdentity) => sql`
    EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = ${userId} AND u.permission_flg = true
            AND u.session_token_hash = ${sessionHash} AND u.session_expires_at > now())`;

export async function editorFromRequest(request: NextRequest, boardId: number) {
    const user = await getCurrentUserFromRequest(request);
    const message = getCardPermissionMessage(user);
    if (message || !user) {
        return { failure: NextResponse.json({ message }, { status: 403 }) };
    }

    if (!Number.isSafeInteger(boardId) || boardId <= 0) {
        return { failure: NextResponse.json({ message: "Invalid editing request." }, { status: 400 }) };
    }

    return {
        identity: {
            userId: user.id,
            sessionHash: getSessionTokenHash(request.cookies.get(sessionCookieName)?.value),
        } satisfies EditorIdentity,
    };
}

import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCardPermissionMessage, getCurrentUserFromRequest } from "@/lib/auth/current-user";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";

export const tabIdPattern = /^[a-zA-Z0-9-]{20,80}$/;

export type EditorIdentity = {
    userId: number;
    sessionHash: string | null;
    tabId: string;
};

export const editorSessionGuard = ({ userId, sessionHash, tabId }: EditorIdentity) => sql`
    EXISTS (
        SELECT 1 FROM users u JOIN editor_leases e ON e.user_id = u.id
        WHERE u.id = ${userId} AND u.permission_flg = true
            AND u.session_token_hash = ${sessionHash} AND u.session_expires_at > now()
            AND e.session_hash = u.session_token_hash AND e.tab_id = ${tabId} AND e.expires_at > now())`;

export async function editorFromRequest(request: NextRequest, boardId: number) {
    const user = await getCurrentUserFromRequest(request);
    const message = getCardPermissionMessage(user);
    if (message || !user) {
        return { failure: NextResponse.json({ message }, { status: 403 }) };
    }

    const tabId = request.headers.get("X-Editor-Tab") ?? "";
    if (!Number.isSafeInteger(boardId) || boardId <= 0 || !tabIdPattern.test(tabId)) {
        return { failure: NextResponse.json({ message: "Invalid editing request." }, { status: 400 }) };
    }

    return {
        identity: {
            userId: user.id,
            sessionHash: getSessionTokenHash(request.cookies.get(sessionCookieName)?.value),
            tabId,
        } satisfies EditorIdentity,
    };
}

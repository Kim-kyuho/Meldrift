import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { boardAccess } from "@/lib/board-access";

export type EditorIdentity = {
    userId: number;
    sessionHash: string | null;
};

// One account holds one live session: signing in elsewhere replaces the hash and the older device
// stops matching here. The board itself is not locked — cards commit one object at a time.
export const editorSessionGuard = ({ userId, sessionHash }: EditorIdentity, boardId: number) => sql`
    EXISTS (
        SELECT 1 FROM users u JOIN boards b ON b.board_id = ${boardId}
        WHERE u.id = ${userId} AND (u.role = 'admin' OR (u.permission_flg AND b.owner_id = u.email))
            AND u.session_token_hash = ${sessionHash} AND u.session_expires_at > now())`;

export async function editorFromRequest(request: NextRequest, boardId: number) {
    const gate = await boardAccess(request, boardId, "edit");
    if (gate.failure) {
        return { failure: gate.failure };
    }
    return {
        failure: null,
        board: gate.board,
        identity: {
            userId: gate.user!.id,
            sessionHash: getSessionTokenHash(request.cookies.get(sessionCookieName)?.value),
        } satisfies EditorIdentity,
    };
}

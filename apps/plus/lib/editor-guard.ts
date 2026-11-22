import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { boardAccess } from "@/lib/board-access";

export type EditorIdentity = {
    userId: number;
    sessionHash: string | null;
};

// One account holds one live session: signing in elsewhere replaces the hash and the older device
// stops matching here. Board editors (members with the editor role) write cards like the owner.
export const editorSessionGuard = ({ userId, sessionHash }: EditorIdentity, boardId: number) => sql`
    EXISTS (
        SELECT 1 FROM users u JOIN boards b ON b.board_id = ${boardId}
        WHERE u.id = ${userId}
            AND (u.role = 'admin' OR (u.permission_flg AND (b.owner_id = u.email OR EXISTS (
                SELECT 1 FROM board_members m
                WHERE m.board_id = b.board_id AND m.user_id = u.id AND m.role = 'editor'))))
            AND u.session_token_hash = ${sessionHash} AND u.session_expires_at > now())`;

// Renaming, visibility, deletion and sharing stay with the owner and administrators.
export const managerSessionGuard = ({ userId, sessionHash }: EditorIdentity, boardId: number) => sql`
    EXISTS (
        SELECT 1 FROM users u JOIN boards b ON b.board_id = ${boardId}
        WHERE u.id = ${userId} AND (u.role = 'admin' OR (u.permission_flg AND b.owner_id = u.email))
            AND u.session_token_hash = ${sessionHash} AND u.session_expires_at > now())`;

async function identityFromRequest(request: NextRequest, boardId: number, action: "edit" | "manage") {
    const gate = await boardAccess(request, boardId, action);
    if (gate.failure) {
        return { failure: gate.failure };
    }
    return {
        failure: null,
        board: gate.board,
        user: gate.user!,
        identity: {
            userId: gate.user!.id,
            sessionHash: getSessionTokenHash(request.cookies.get(sessionCookieName)?.value),
        } satisfies EditorIdentity,
    };
}

export const editorFromRequest = (request: NextRequest, boardId: number) =>
    identityFromRequest(request, boardId, "edit");

export const managerFromRequest = (request: NextRequest, boardId: number) =>
    identityFromRequest(request, boardId, "manage");

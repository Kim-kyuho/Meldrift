import { sql } from "drizzle-orm";
import { findSessionUserById } from "@/lib/auth/current-user";
import { boardAccessFor } from "@/lib/board-access";
import { canEditBoard } from "@/lib/board-permissions";
import { getDb } from "@/lib/db";
import { colorFor, liveCloseCodes, type LiveRole } from "../protocol";
import type { LiveTokenPayload } from "../token";

export type LiveIdentity = {
    boardId: number;
    clientId: string;
    userId: number | null;
    email: string | null;
    role: LiveRole;
    canEdit: boolean;
    // 소유자·관리자·공유 멤버만 다른 사람의 전체 이메일을 본다.
    seesEmails: boolean;
    color: string;
    token: LiveTokenPayload;
};

export type IdentityResult = { identity: LiveIdentity; closeCode: null } | { identity: null; closeCode: number };

const closeCodeForStatus = (status: number) => {
    if (status === 401) {
        return liveCloseCodes.unauthenticated;
    }
    if (status === 403) {
        return liveCloseCodes.forbidden;
    }
    if (status === 404) {
        return liveCloseCodes.missing;
    }
    return liveCloseCodes.badRequest;
};

export async function resolveLiveIdentity(token: LiveTokenPayload): Promise<IdentityResult> {
    // 로그인한 사용자만 연결한다. 세션이 바뀌었으면 거절한다.
    if (token.u === null || !token.s) {
        return { identity: null, closeCode: liveCloseCodes.unauthenticated };
    }
    const user = await findSessionUserById(token.u, token.s);
    if (!user) {
        return { identity: null, closeCode: liveCloseCodes.unauthenticated };
    }
    const gate = await boardAccessFor(user, token.b, "read");
    if (gate.failure) {
        return { identity: null, closeCode: closeCodeForStatus(gate.failure.status) };
    }
    // 협업을 끈 보드는 연결하지 않는다. 연결 중에 끄면 60초 안의 재검증에서 닫힌다.
    if (gate.board.collabFlg !== 1) {
        return { identity: null, closeCode: liveCloseCodes.missing };
    }
    const canEdit = canEditBoard(user, gate.board, gate.memberRole);
    const seesEmails = user.role === "admin" || user.email === gate.board.ownerId || gate.memberRole !== null;
    const role: LiveRole = canEdit ? "editor" : "viewer";
    return {
        closeCode: null,
        identity: {
            boardId: token.b,
            clientId: token.c,
            userId: user.id,
            email: user.email,
            role,
            canEdit,
            seesEmails,
            color: colorFor(`user:${user.id}`),
            token,
        },
    };
}

export async function boardHeadRevision(boardId: number) {
    const result = await getDb().execute(sql`SELECT revision FROM board_sync WHERE board_id = ${boardId}`);
    return Number(result.rows[0]?.revision ?? 0);
}

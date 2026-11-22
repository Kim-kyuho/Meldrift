import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { boardAccess } from "@/lib/board-access";
import { liveEnabled } from "@/lib/live/store";
import { liveTokenTtlMs, signLiveToken } from "@/lib/live/token";

type Context = { params: Promise<{ boardId: string }> };

const json = (data: object, status = 200) =>
    NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

const tokenRequest = z.object({ clientId: z.string().uuid() }).strict();

// 쿠키로 인증한 HTTP 요청에서 60초짜리 연결 토큰을 발급한다. WebSocket은 이 토큰으로만 인증한다.
export async function POST(request: NextRequest, { params }: Context) {
    if (!liveEnabled()) {
        return json({ ok: false, message: "Live collaboration is turned off." }, 404);
    }
    const boardId = Number((await params).boardId);
    const parsed = tokenRequest.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return json({ ok: false, message: "Invalid live connection request." }, 400);
    }
    const gate = await boardAccess(request, boardId, "read");
    if (gate.failure) {
        return gate.failure;
    }
    if (!gate.user) {
        return json({ ok: false, message: "Sign in to join live collaboration." }, 401);
    }
    if (gate.board.collabFlg !== 1) {
        return json({ ok: false, message: "Live collaboration is turned off for this board." }, 404);
    }
    const expiresAt = Date.now() + liveTokenTtlMs;
    const token = signLiveToken({
        b: boardId,
        u: gate.user.id,
        s: getSessionTokenHash(request.cookies.get(sessionCookieName)?.value),
        c: parsed.data.clientId,
        e: expiresAt,
    });
    return json({ ok: true, token, expiresAt });
}

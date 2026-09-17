import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getCurrentUserFromRequest, getCardPermissionMessage } from "@/lib/auth/current-user";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
    const user = await getCurrentUserFromRequest(request);
    const message = getCardPermissionMessage(user);
    if (message || !user) return NextResponse.json({ message }, { status: 403 });
    const body = await request.json().catch(() => null);
    const tabId = body?.tabId;
    if (typeof tabId !== "string" || !/^[a-zA-Z0-9-]{20,80}$/.test(tabId)) {
        return NextResponse.json({ message: "Invalid editor identifier." }, { status: 400 });
    }
    const hash = getSessionTokenHash(request.cookies.get(sessionCookieName)?.value);
    const result = await getDb().execute(sql`
        INSERT INTO editor_leases (user_id, session_hash, tab_id, expires_at)
        SELECT id, session_token_hash, ${tabId}, now() + interval '60 seconds'
        FROM users WHERE id = ${user.id} AND session_token_hash = ${hash}
            AND session_expires_at > now() AND permission_flg = true
        ON CONFLICT (user_id) DO UPDATE SET
            session_hash = excluded.session_hash, tab_id = excluded.tab_id, expires_at = excluded.expires_at
        WHERE editor_leases.expires_at <= now()
            OR editor_leases.session_hash <> excluded.session_hash
            OR editor_leases.tab_id = excluded.tab_id
        RETURNING user_id
    `);
    return result.rows.length
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ message: "This account is already editing in another tab." }, { status: 409 });
}

export async function DELETE(request: NextRequest) {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return new NextResponse(null, { status: 204 });
    const body = await request.json().catch(() => null);
    const tabId = body?.tabId;
    if (typeof tabId !== "string") return new NextResponse(null, { status: 400 });
    await getDb().execute(sql`DELETE FROM editor_leases WHERE user_id = ${user.id} AND tab_id = ${tabId}`);
    return new NextResponse(null, { status: 204 });
}

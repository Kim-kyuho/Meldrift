import { upgradeWebSocket } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { liveLimits } from "@/lib/live/protocol";
import { liveOriginAllowed } from "@/lib/live/server/origin";
import { getLiveHub } from "@/lib/live/server/hub";
import { resolveLiveIdentity } from "@/lib/live/server/identity";
import { fromWebSocket } from "@/lib/live/server/socket";
import { getLiveStore } from "@/lib/live/store";
import { verifyLiveToken } from "@/lib/live/token";

type Context = { params: Promise<{ boardId: string }> };

// 연결 수명. Hobby는 300초가 상한이다. Pro에서 늘릴 때는 LIVE_MAX_DURATION_SECONDS도 같은 값으로 맞춘다.
export const maxDuration = 300;

const refuse = (status: number, message: string) =>
    NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest, { params }: Context) {
    const store = getLiveStore();
    if (!store) {
        return refuse(404, "Live collaboration is turned off.");
    }
    if (!liveOriginAllowed(request.headers.get("origin"), request.headers.get("host"))) {
        return refuse(403, "This origin cannot open live connections.");
    }
    const boardId = Number((await params).boardId);
    const token = verifyLiveToken(request.nextUrl.searchParams.get("token"));
    if (!token || token.b !== boardId) {
        return refuse(401, "The live connection token is missing or expired.");
    }
    const result = await resolveLiveIdentity(token);
    if (result.closeCode !== null) {
        return refuse(result.closeCode === 4404 ? 404 : 403, "You cannot open this board.");
    }
    const hub = getLiveHub(store);
    return upgradeWebSocket((socket) => {
        hub.attach(fromWebSocket(socket), result.identity);
    }, { maxPayload: liveLimits.messageBytes });
}

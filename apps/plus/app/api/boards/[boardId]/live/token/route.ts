import type { NextRequest } from "next/server";
import { getSessionTokenHash, sessionCookieName } from "@/lib/auth/session";
import { boardAccess } from "@/lib/board-access";
import { canEditBoard } from "@/lib/board-permissions";
import { boardHeadRevision, withTimeout } from "@/lib/live/commit-events";
import { colorFor } from "@/lib/live/protocol";
import { readLiveBody, serveLiveRoom, type LiveRouteContext } from "@/lib/live/p2p/http";
import { roomStatus } from "@/lib/live/p2p/locks";
import { joinPeerRoomSchema, peerRoomLimits, type RoomGrant } from "@/lib/live/p2p/protocol";
import { RoomFailure } from "@/lib/live/p2p/rooms";
import { liveTokenTtlMs, signLiveToken } from "@/lib/live/token";

export function POST(request: NextRequest, context: LiveRouteContext) {
    return serveLiveRoom(request, context, async (store, rooms, boardId) => {
        const { clientId, leaseId } = await readLiveBody(request, joinPeerRoomSchema);
        const gate = await boardAccess(request, boardId, "read");
        if (gate.failure) {
            return gate.failure;
        }
        const { user, board, memberRole } = gate;
        const sessionHash = getSessionTokenHash(request.cookies.get(sessionCookieName)?.value);
        if (!user || !sessionHash) {
            throw new RoomFailure(401, "Sign in to join Live collaboration.");
        }
        if (board.collabFlg !== 1) {
            throw new RoomFailure(404, "Live collaboration is turned off for this board.");
        }
        const now = Date.now();
        const expiresAt = now + liveTokenTtlMs;
        const token = signLiveToken({ b: boardId, u: user.id, s: sessionHash, c: clientId, l: leaseId, e: expiresAt });
        const seesEmails = user.role === "admin" || user.email === board.ownerId || memberRole !== null;
        const [view, head] = await withTimeout(Promise.all([
            rooms.join({
                clientId, leaseId, userId: user.id, email: user.email, role: canEditBoard(user, board, memberRole) ? "editor" : "viewer",
                color: colorFor(`user:${user.id}`), seesEmails, joinedAt: now, expiresAt: now + peerRoomLimits.leaseMs,
            }),
            boardHeadRevision(boardId),
        ]), 5_000);
        const status = await withTimeout(roomStatus(store, boardId, view, seesEmails));
        return { token, expiresAt, status: { ...status, head: Math.max(status.head, head) } } satisfies RoomGrant;
    });
}

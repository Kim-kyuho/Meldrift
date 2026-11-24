import { readLiveBody, serveLiveRoom, type LiveRouteContext } from "@/lib/live/p2p/http";
import { acquireLiveLocks, releaseLiveLocks, renewLiveLocks, roomStatus } from "@/lib/live/p2p/locks";
import { roomRequestSchema } from "@/lib/live/p2p/protocol";
import { RoomFailure } from "@/lib/live/p2p/rooms";
import { withTimeout } from "@/lib/live/commit-events";
import { verifyLiveToken } from "@/lib/live/token";

export const maxDuration = 10;

export function POST(request: Request, context: LiveRouteContext) {
    return serveLiveRoom(request, context, async (store, rooms, boardId) => {
        const header = request.headers.get("authorization");
        const token = verifyLiveToken(header?.startsWith("Bearer ") ? header.slice(7) : null);
        if (!token || token.b !== boardId || token.u === null || !token.s || !token.l) {
            throw new RoomFailure(401, "Your Live token expired. Reconnecting…");
        }
        const action = await readLiveBody(request, roomRequestSchema);
        const key = { userId: token.u, clientId: token.c, leaseId: token.l };
        return withTimeout((async () => {
            if (action.kind === "leave") {
                await rooms.leave(key);
                return { ok: true };
            }
            if (action.kind === "pulse") {
                const { seat, view } = await rooms.pulse(key, token.e, action.epoch, action.signals);
                if (action.holding) {
                    await renewLiveLocks(store, boardId, seat);
                }
                return roomStatus(store, boardId, view, seat.seesEmails);
            }
            const seat = await rooms.seat(key);
            if (action.kind === "acquire") {
                return acquireLiveLocks(store, boardId, seat, action.keys, action.intent);
            }
            await releaseLiveLocks(store, boardId, seat, action.keys);
            return { ok: true };
        })(), 5_000);
    });
}

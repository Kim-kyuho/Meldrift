import { exchangeSchema } from "@/lib/peer-live/signaling/protocol";
import { credentialOf, roomBody, serveRoomRequest, type RoomRouteContext } from "@/lib/peer-live/signaling/routes";

export function POST(request: Request, context: RoomRouteContext) {
    return serveRoomRequest(request, "exchange", context, async (rooms, id) =>
        rooms.exchange(id, credentialOf(request), await roomBody(request, exchangeSchema)));
}

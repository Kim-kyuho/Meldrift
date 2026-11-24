import { joinRoomSchema } from "@/lib/peer-live/signaling/protocol";
import { credentialOf, roomBody, serveRoomRequest, type RoomRouteContext } from "@/lib/peer-live/signaling/routes";

export function POST(request: Request, context: RoomRouteContext) {
    return serveRoomRequest(request, "join", context, async (rooms, id) =>
        rooms.join(id, credentialOf(request), await roomBody(request, joinRoomSchema)));
}

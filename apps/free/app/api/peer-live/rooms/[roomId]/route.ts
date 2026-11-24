import { roomActionSchema } from "@/lib/peer-live/signaling/protocol";
import { credentialOf, roomBody, serveRoomRequest, type RoomRouteContext } from "@/lib/peer-live/signaling/routes";

export function PATCH(request: Request, context: RoomRouteContext) {
    return serveRoomRequest(request, "manage", context, async (rooms, id) =>
        rooms.manage(id, credentialOf(request), await roomBody(request, roomActionSchema)));
}

export function DELETE(request: Request, context: RoomRouteContext) {
    return serveRoomRequest(request, "manage", context, (rooms, id) => rooms.close(id, credentialOf(request)));
}

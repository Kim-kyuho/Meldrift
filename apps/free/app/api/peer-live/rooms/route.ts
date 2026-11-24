import { createRoomSchema } from "@/lib/peer-live/signaling/protocol";
import { roomBody, serveRoomRequest } from "@/lib/peer-live/signaling/routes";

export function POST(request: Request) {
    return serveRoomRequest(request, "create", null, async (rooms) => {
        const { name } = await roomBody(request, createRoomSchema);
        return rooms.create(name);
    });
}

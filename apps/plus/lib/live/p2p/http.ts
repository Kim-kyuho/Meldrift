import type { ZodType } from "zod";
import { validBoardId } from "@/lib/board-access";
import { liveOriginAllowed } from "../server/origin";
import { getLiveStore, liveEnabled, type LiveStore } from "../store";
import { PeerRooms, RoomFailure } from "./rooms";
import { peerRoomLimits } from "./protocol";

export type LiveRouteContext = { params: Promise<{ boardId: string }> };
const noStore = { "Cache-Control": "no-store" };

export async function readLiveBody<T>(request: Request, schema: ZodType<T>) {
    if (!request.body || Number(request.headers.get("content-length")) > peerRoomLimits.bodyBytes) {
        throw new RoomFailure(400, "Invalid Live request.");
    }
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            size += value.byteLength;
            if (size > peerRoomLimits.bodyBytes) {
                await reader.cancel();
                throw new Error("Request too large.");
            }
            chunks.push(value);
        }
        return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
        throw new RoomFailure(400, "Invalid Live request.");
    } finally {
        reader.releaseLock();
    }
}

export async function serveLiveRoom(
    request: Request,
    context: LiveRouteContext,
    action: (store: LiveStore, rooms: PeerRooms, boardId: number) => Promise<unknown>,
) {
    try {
        const boardId = Number((await context.params).boardId);
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
        if (!validBoardId(boardId)) {
            throw new RoomFailure(400, "Invalid board id.");
        }
        if (!liveOriginAllowed(request.headers.get("origin"), host)) {
            throw new RoomFailure(403, "Open Live collaboration from the board.");
        }
        if (!liveEnabled()) {
            throw new RoomFailure(404, "Live collaboration is turned off.");
        }
        const store = getLiveStore();
        if (!store) {
            throw new RoomFailure(503, "Live collaboration is unavailable.");
        }
        const result = await action(store, new PeerRooms(store, boardId), boardId);
        return result instanceof Response ? result : Response.json(result, { headers: noStore });
    } catch (error) {
        const failure = error instanceof RoomFailure ? error : new RoomFailure(503, "The Live room could not respond.");
        return Response.json({ message: failure.message }, { status: failure.status, headers: noStore });
    }
}

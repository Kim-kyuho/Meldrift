import type { ZodType } from "zod";
import { roomIdSchema, roomLimits, tokenSchema } from "./protocol";
import { getRoomStore } from "./store";
import { PeerRooms, RoomError } from "./rooms";

const noStore = { "Cache-Control": "no-store" };
const invalidRequest = () => new RoomError(400, "invalid_request", "The room request is invalid.");

export function credentialOf(request: Request) {
    const header = request.headers.get("authorization");
    const credential = header?.startsWith("Bearer ") ? header.slice(7) : "";
    if (!tokenSchema.safeParse(credential).success) {
        throw new RoomError(403, "forbidden", "This invitation or seat is no longer valid.");
    }
    return credential;
}

function checkOrigin(request: Request) {
    const expected = new URL(request.url);
    // A TLS-terminating proxy can put its backend address in Host.
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? expected.host;
    const protocol = request.headers.get("x-forwarded-proto") === "https" ? "https:" : expected.protocol;
    if (request.headers.get("origin") !== `${protocol}//${host}`) {
        throw new RoomError(403, "forbidden", "Open collaboration from the Meldrift page.");
    }
}

export async function roomBody<T>(request: Request, schema: ZodType<T>) {
    if (Number(request.headers.get("content-length")) > roomLimits.bodyBytes || !request.body) {
        throw invalidRequest();
    }
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            length += value.byteLength;
            if (length > roomLimits.bodyBytes) {
                await reader.cancel();
                throw invalidRequest();
            }
            chunks.push(value);
        }
        const result = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        if (!result.success) {
            throw invalidRequest();
        }
        return result.data;
    } catch {
        throw invalidRequest();
    } finally {
        reader.releaseLock();
    }
}

export type RoomRouteContext = { params: Promise<{ roomId: string }> };

export async function serveRoomRequest(
    request: Request,
    action: Parameters<PeerRooms["throttle"]>[0],
    context: RoomRouteContext | null,
    run: (rooms: PeerRooms, roomId: string) => Promise<unknown>,
) {
    try {
        checkOrigin(request);
        const roomId = context ? (await context.params).roomId : "";
        if (context && !roomIdSchema.safeParse(roomId).success) {
            throw invalidRequest();
        }
        const store = getRoomStore();
        if (!store) {
            throw new RoomError(503, "signaling_unavailable", "Live collaboration is unavailable.");
        }
        const rooms = new PeerRooms(store);
        const address = request.headers.get("x-vercel-forwarded-for") ?? "local";
        await rooms.throttle(action, address, roomId);
        return Response.json(await run(rooms, roomId), { headers: noStore });
    } catch (error) {
        const failure = error instanceof RoomError
            ? error
            : new RoomError(503, "signaling_unavailable", "The room service is unavailable. Try again shortly.");
        return Response.json({ code: failure.code, message: failure.message }, { status: failure.status, headers: noStore });
    }
}

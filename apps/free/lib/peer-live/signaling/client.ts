import type {
    HostExchange, HostGrant, HostUpdate, JoinRequest, ParticipantExchange, ParticipantGrant, RoomAction,
} from "./protocol";

const endpoint = "/api/peer-live/rooms";

export class SignalError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
    }
}

async function request<T>(path: string, method: string, data?: object, credential?: string): Promise<T> {
    const headers: Record<string, string> = {};
    if (data) {
        headers["Content-Type"] = "application/json";
    }
    if (credential) {
        headers.Authorization = `Bearer ${credential}`;
    }
    const response = await fetch(`${endpoint}${path}`, {
        method, headers, body: data && JSON.stringify(data), cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => null) as { code?: string; message?: string } | null;
        throw new SignalError(response.status, error?.code ?? "request_failed", error?.message ?? "The room is unavailable.");
    }
    return response.json() as Promise<T>;
}

export const createRoom = (name: string) => request<HostGrant>("", "POST", { name });

export class RoomSignaling {
    constructor(readonly roomId: string, private readonly credential: string) {}

    join(data: JoinRequest) {
        return request<ParticipantGrant>(`/${this.roomId}/join`, "POST", data, this.credential);
    }

    hostExchange(updates: HostUpdate[]) {
        return request<HostExchange>(`/${this.roomId}/exchange`, "POST", { kind: "host", updates }, this.credential);
    }

    participantExchange(attemptId: string, answer?: string) {
        return request<ParticipantExchange>(`/${this.roomId}/exchange`, "POST", { kind: "participant", attemptId, answer }, this.credential);
    }

    leave(attemptId: string) {
        return request<ParticipantExchange>(`/${this.roomId}/exchange`, "POST", { kind: "participant", attemptId, leave: true }, this.credential);
    }

    manage(action: RoomAction) {
        return request<{ inviteSecret?: string }>(`/${this.roomId}`, "PATCH", action, this.credential);
    }

    close() {
        return request(`/${this.roomId}`, "DELETE", undefined, this.credential);
    }
}

export function makeParticipantToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function invitationUrl(roomId: string, inviteSecret: string) {
    return new URL(`/live/join/${roomId}#k=${inviteSecret}`, window.location.origin).href;
}

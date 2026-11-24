import { createHmac, timingSafeEqual } from "node:crypto";

export const liveTokenTtlMs = 60_000;

export type LiveTokenPayload = {
    b: number;
    u: number | null;
    s: string | null;
    c: string;
    e: number;
    l?: string;
};

function tokenSecret() {
    const secret = process.env.LIVE_TOKEN_SECRET;
    if (secret) {
        return secret;
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error("LIVE_TOKEN_SECRET is not set.");
    }
    return "meldrift-live-development-secret";
}

const sign = (body: string) => createHmac("sha256", tokenSecret()).update(body).digest("base64url");

// A short-lived token binds HTTP signaling to the browser's authenticated seat.
export function signLiveToken(payload: LiveTokenPayload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${sign(body)}`;
}

export function verifyLiveToken(token: string | null, now = Date.now()): LiveTokenPayload | null {
    if (!token || token.length > 2048) {
        return null;
    }
    const [body, signature] = token.split(".");
    if (!body || !signature) {
        return null;
    }
    const expected = Buffer.from(sign(body));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LiveTokenPayload;
        if (typeof payload.e !== "number" || payload.e < now) {
            return null;
        }
        if (!Number.isSafeInteger(payload.b) || typeof payload.c !== "string") {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

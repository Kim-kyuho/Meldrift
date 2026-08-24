import { createHash, randomBytes } from "crypto";

export const sessionCookieName = "kyuboard_session";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export function createSessionToken() {
    return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

export function getSessionTokenHash(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return null;
    }

    return hashSessionToken(token);
}

export function createSessionExpiresAt(now = Date.now()) {
    return new Date(now + sessionMaxAgeSeconds * 1000);
}

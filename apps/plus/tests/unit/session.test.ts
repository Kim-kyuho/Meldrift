import { describe, expect, it } from "vitest";
import {
    createSessionExpiresAt,
    createSessionToken,
    getSessionTokenHash,
    hashSessionToken,
    sessionCookieName,
    sessionMaxAgeSeconds,
} from "@/lib/auth/session";

describe("session tokens", () => {
    it("uses the expected cookie name and creates a random token", () => {
        const firstToken = createSessionToken();
        const secondToken = createSessionToken();

        expect(sessionCookieName).toBe("kyuboard_session");
        expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(secondToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(firstToken).not.toBe(secondToken);
    });

    it("hashes a valid session token with SHA-256", () => {
        const token = createSessionToken();
        const tokenHash = hashSessionToken(token);

        expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(getSessionTokenHash(token)).toBe(tokenHash);
    });

    it.each([
        undefined,
        "",
        "not-a-token",
        "a".repeat(42),
        "a".repeat(44),
        `${"a".repeat(42)}+`,
    ])("rejects invalid token %s", (token) => {
        expect(getSessionTokenHash(token)).toBeNull();
    });

    it("creates a seven-day server expiration", () => {
        const now = Date.UTC(2026, 7, 21, 0, 0, 0);

        expect(createSessionExpiresAt(now).getTime()).toBe(
            now + sessionMaxAgeSeconds * 1000,
        );
    });
});

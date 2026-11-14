import { describe, expect, it } from "vitest";
import {
    createSessionExpiresAt,
    createSessionToken,
    getSessionTokenHash,
    hashSessionToken,
    sessionCookieName,
    sessionMaxAgeSeconds,
} from "@/lib/auth/session";

describe("세션 토큰", () => {
    it("예정된 쿠키 이름을 사용하고 난수 토큰을 생성한다", () => {
        const firstToken = createSessionToken();
        const secondToken = createSessionToken();

        expect(sessionCookieName).toBe("meldrift_session");
        expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(secondToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(firstToken).not.toBe(secondToken);
    });

    it("유효한 세션 토큰을 SHA-256으로 해시한다", () => {
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
    ])("잘못된 토큰 %s를 거부한다", (token) => {
        expect(getSessionTokenHash(token)).toBeNull();
    });

    it("서버 만료 기간을 7일로 설정한다", () => {
        const now = Date.UTC(2026, 7, 21, 0, 0, 0);

        expect(createSessionExpiresAt(now).getTime()).toBe(
            now + sessionMaxAgeSeconds * 1000,
        );
    });
});

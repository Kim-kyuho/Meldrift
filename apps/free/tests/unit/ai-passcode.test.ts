import { describe, expect, it } from "vitest";
import {
    aiSessionMaxAgeSeconds,
    createAiSessionToken,
    isAiPasswordConfigured,
    verifyAiPassword,
    verifyAiSessionToken,
} from "@/lib/ai/passcode";
import {
    clearFailures,
    getAttemptKey,
    isThrottled,
    lockoutWindowMs,
    maxFailedAttempts,
    recordFailure,
    type AttemptStore,
} from "@/lib/ai/unlock-throttle";

// 잠금은 어시스턴트의 유일한 접근 통제이고, 뚫리면 곧 AI 호출 비용으로 돌아온다.
// 그래서 비밀번호 비교와 토큰 검증은 환경변수를 건드리지 않고 인자로 넣어 직접 검증한다.

const password = "correct horse battery staple";

describe("isAiPasswordConfigured", () => {
    it("requires a non-empty password", () => {
        expect(isAiPasswordConfigured(password)).toBe(true);
        expect(isAiPasswordConfigured("")).toBe(false);
        expect(isAiPasswordConfigured(undefined)).toBe(false);
    });
});

describe("verifyAiPassword", () => {
    it("accepts the configured password", () => {
        expect(verifyAiPassword(password, password)).toBe(true);
    });

    it("rejects a wrong password", () => {
        expect(verifyAiPassword("wrong", password)).toBe(false);
        expect(verifyAiPassword(`${password} `, password)).toBe(false);
        expect(verifyAiPassword(password.slice(0, -1), password)).toBe(false);
    });

    it("rejects non-string candidates", () => {
        expect(verifyAiPassword(undefined, password)).toBe(false);
        expect(verifyAiPassword(null, password)).toBe(false);
        expect(verifyAiPassword(123, password)).toBe(false);
        expect(verifyAiPassword({}, password)).toBe(false);
    });

    // 비밀번호를 설정하지 않은 서버가 무료 어시스턴트가 되면 안 된다.
    it("rejects everything when no password is configured", () => {
        expect(verifyAiPassword("", "")).toBe(false);
        expect(verifyAiPassword("anything", "")).toBe(false);
        expect(verifyAiPassword("anything", undefined)).toBe(false);
    });
});

describe("AI session token", () => {
    const now = 1_700_000_000_000;

    it("round-trips a freshly issued token", () => {
        const token = createAiSessionToken(password, now);

        expect(verifyAiSessionToken(token, password, now)).toBe(true);
    });

    it("throws instead of issuing a token without a password", () => {
        expect(() => createAiSessionToken("", now)).toThrow();
        expect(() => createAiSessionToken(undefined, now)).toThrow();
    });

    it("expires when the lifetime has passed", () => {
        const token = createAiSessionToken(password, now);
        const lifetimeMs = aiSessionMaxAgeSeconds * 1000;

        expect(verifyAiSessionToken(token, password, now + lifetimeMs - 1000)).toBe(true);
        expect(verifyAiSessionToken(token, password, now + lifetimeMs + 1000)).toBe(false);
    });

    // 서명 키를 비밀번호에서 파생시키는 이유가 이것이다. 비밀번호를 바꾸면 전부 무효가 된다.
    it("stops accepting tokens once the password changes", () => {
        const token = createAiSessionToken(password, now);

        expect(verifyAiSessionToken(token, "a new password", now)).toBe(false);
    });

    it("rejects a tampered expiry", () => {
        const token = createAiSessionToken(password, now);
        const [version, expiresAt, signature] = token.split(".");
        const forged = `${version}.${Number(expiresAt) + 60 * 60 * 24 * 365}.${signature}`;

        expect(verifyAiSessionToken(forged, password, now)).toBe(false);
    });

    it("rejects a tampered signature", () => {
        const [version, expiresAt] = createAiSessionToken(password, now).split(".");

        expect(verifyAiSessionToken(`${version}.${expiresAt}.forged`, password, now)).toBe(false);
        expect(verifyAiSessionToken(`${version}.${expiresAt}.`, password, now)).toBe(false);
    });

    it("rejects malformed and missing tokens", () => {
        expect(verifyAiSessionToken(undefined, password, now)).toBe(false);
        expect(verifyAiSessionToken("", password, now)).toBe(false);
        expect(verifyAiSessionToken("v1.123", password, now)).toBe(false);
        expect(verifyAiSessionToken("v1.123.abc.def", password, now)).toBe(false);
        expect(verifyAiSessionToken("v1.notanumber.abc", password, now)).toBe(false);
        expect(verifyAiSessionToken(42, password, now)).toBe(false);
    });

    it("rejects a token whose version this server does not issue", () => {
        const [, expiresAt, signature] = createAiSessionToken(password, now).split(".");

        expect(verifyAiSessionToken(`v2.${expiresAt}.${signature}`, password, now)).toBe(false);
    });

    it("rejects any token when no password is configured", () => {
        const token = createAiSessionToken(password, now);

        expect(verifyAiSessionToken(token, "", now)).toBe(false);
        expect(verifyAiSessionToken(token, undefined, now)).toBe(false);
    });
});

describe("unlock throttle", () => {
    const key = "203.0.113.7";
    const now = 1_700_000_000_000;
    const newStore = (): AttemptStore => new Map();

    it("throttles only after the attempt limit is reached", () => {
        const store = newStore();

        for (let attempt = 1; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
            expect(isThrottled(key, now, store)).toBe(false);
        }

        recordFailure(key, now, store);
        expect(isThrottled(key, now, store)).toBe(true);
    });

    it("counts each key separately", () => {
        const store = newStore();

        for (let attempt = 0; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
        }

        expect(isThrottled(key, now, store)).toBe(true);
        expect(isThrottled("198.51.100.2", now, store)).toBe(false);
    });

    it("forgets failures once the window has passed", () => {
        const store = newStore();

        for (let attempt = 0; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
        }

        expect(isThrottled(key, now + lockoutWindowMs - 1, store)).toBe(true);
        expect(isThrottled(key, now + lockoutWindowMs, store)).toBe(false);
        expect(store.has(key)).toBe(false);
    });

    it("clears failures after a successful unlock", () => {
        const store = newStore();

        for (let attempt = 0; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
        }
        clearFailures(key, store);

        expect(isThrottled(key, now, store)).toBe(false);
    });

    it("keys attempts by the first forwarded address", () => {
        expect(getAttemptKey(new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7");
        expect(getAttemptKey(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
        expect(getAttemptKey(new Headers())).toBe("unknown");
    });
});

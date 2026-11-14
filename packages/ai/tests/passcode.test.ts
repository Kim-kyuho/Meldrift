import { describe, expect, it } from "vitest";
import {
    aiSessionMaxAgeSeconds,
    createAiSessionToken,
    isAiPasswordConfigured,
    verifyAiPassword,
    verifyAiSessionToken,
} from "../src/passcode";
import {
    clearFailures,
    getAttemptKey,
    isThrottled,
    lockoutWindowMs,
    maxFailedAttempts,
    recordFailure,
    type AttemptStore,
} from "../src/unlock-throttle";

// 잠금은 어시스턴트의 유일한 접근 통제이고, 뚫리면 곧 AI 호출 비용으로 돌아온다.
// 그래서 비밀번호 비교와 토큰 검증은 환경변수를 건드리지 않고 인자로 넣어 직접 검증한다.

const password = "correct horse battery staple";

describe("isAiPasswordConfigured 동작", () => {
    it("비어 있지 않은 비밀번호를 요구한다", () => {
        expect(isAiPasswordConfigured(password)).toBe(true);
        expect(isAiPasswordConfigured("")).toBe(false);
        expect(isAiPasswordConfigured(undefined)).toBe(false);
    });
});

describe("verifyAiPassword 동작", () => {
    it("설정된 비밀번호를 허용한다", () => {
        expect(verifyAiPassword(password, password)).toBe(true);
    });

    it("잘못된 비밀번호를 거부한다", () => {
        expect(verifyAiPassword("wrong", password)).toBe(false);
        expect(verifyAiPassword(`${password} `, password)).toBe(false);
        expect(verifyAiPassword(password.slice(0, -1), password)).toBe(false);
    });

    it("문자열이 아닌 입력을 거부한다", () => {
        expect(verifyAiPassword(undefined, password)).toBe(false);
        expect(verifyAiPassword(null, password)).toBe(false);
        expect(verifyAiPassword(123, password)).toBe(false);
        expect(verifyAiPassword({}, password)).toBe(false);
    });

    // 비밀번호를 설정하지 않은 서버가 무료 어시스턴트가 되면 안 된다.
    it("비밀번호를 설정하지 않았으면 모든 입력을 거부한다", () => {
        expect(verifyAiPassword("", "")).toBe(false);
        expect(verifyAiPassword("anything", "")).toBe(false);
        expect(verifyAiPassword("anything", undefined)).toBe(false);
    });
});

describe("AI 세션 토큰", () => {
    const now = 1_700_000_000_000;

    it("새로 발급한 토큰을 검증해 복원한다", () => {
        const token = createAiSessionToken(password, now);

        expect(verifyAiSessionToken(token, password, now)).toBe(true);
    });

    it("비밀번호가 없으면 토큰을 발급하지 않고 예외를 발생시킨다", () => {
        expect(() => createAiSessionToken("", now)).toThrow();
        expect(() => createAiSessionToken(undefined, now)).toThrow();
    });

    it("유효 기간이 지나면 만료된다", () => {
        const token = createAiSessionToken(password, now);
        const lifetimeMs = aiSessionMaxAgeSeconds * 1000;

        expect(verifyAiSessionToken(token, password, now + lifetimeMs - 1000)).toBe(true);
        expect(verifyAiSessionToken(token, password, now + lifetimeMs + 1000)).toBe(false);
    });

    // 서명 키를 비밀번호에서 파생시키는 이유가 이것이다. 비밀번호를 바꾸면 전부 무효가 된다.
    it("비밀번호가 바뀌면 기존 토큰을 거부한다", () => {
        const token = createAiSessionToken(password, now);

        expect(verifyAiSessionToken(token, "a new password", now)).toBe(false);
    });

    it("변조된 만료 시각을 거부한다", () => {
        const token = createAiSessionToken(password, now);
        const [version, expiresAt, signature] = token.split(".");
        const forged = `${version}.${Number(expiresAt) + 60 * 60 * 24 * 365}.${signature}`;

        expect(verifyAiSessionToken(forged, password, now)).toBe(false);
    });

    it("변조된 서명을 거부한다", () => {
        const [version, expiresAt] = createAiSessionToken(password, now).split(".");

        expect(verifyAiSessionToken(`${version}.${expiresAt}.forged`, password, now)).toBe(false);
        expect(verifyAiSessionToken(`${version}.${expiresAt}.`, password, now)).toBe(false);
    });

    it("형식이 잘못되었거나 누락된 토큰을 거부한다", () => {
        expect(verifyAiSessionToken(undefined, password, now)).toBe(false);
        expect(verifyAiSessionToken("", password, now)).toBe(false);
        expect(verifyAiSessionToken("v1.123", password, now)).toBe(false);
        expect(verifyAiSessionToken("v1.123.abc.def", password, now)).toBe(false);
        expect(verifyAiSessionToken("v1.notanumber.abc", password, now)).toBe(false);
        expect(verifyAiSessionToken(42, password, now)).toBe(false);
    });

    it("서버가 발급하지 않는 버전의 토큰을 거부한다", () => {
        const [, expiresAt, signature] = createAiSessionToken(password, now).split(".");

        expect(verifyAiSessionToken(`v2.${expiresAt}.${signature}`, password, now)).toBe(false);
    });

    it("비밀번호가 설정되지 않았으면 모든 토큰을 거부한다", () => {
        const token = createAiSessionToken(password, now);

        expect(verifyAiSessionToken(token, "", now)).toBe(false);
        expect(verifyAiSessionToken(token, undefined, now)).toBe(false);
    });
});

describe("잠금 해제 시도 제한", () => {
    const key = "203.0.113.7";
    const now = 1_700_000_000_000;
    const newStore = (): AttemptStore => new Map();

    it("시도 횟수 제한에 도달한 뒤에만 요청을 제한한다", () => {
        const store = newStore();

        for (let attempt = 1; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
            expect(isThrottled(key, now, store)).toBe(false);
        }

        recordFailure(key, now, store);
        expect(isThrottled(key, now, store)).toBe(true);
    });

    it("키별로 시도 횟수를 따로 계산한다", () => {
        const store = newStore();

        for (let attempt = 0; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
        }

        expect(isThrottled(key, now, store)).toBe(true);
        expect(isThrottled("198.51.100.2", now, store)).toBe(false);
    });

    it("집계 시간이 지나면 실패 횟수를 초기화한다", () => {
        const store = newStore();

        for (let attempt = 0; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
        }

        expect(isThrottled(key, now + lockoutWindowMs - 1, store)).toBe(true);
        expect(isThrottled(key, now + lockoutWindowMs, store)).toBe(false);
        expect(store.has(key)).toBe(false);
    });

    it("잠금 해제 성공 후 실패 횟수를 지운다", () => {
        const store = newStore();

        for (let attempt = 0; attempt < maxFailedAttempts; attempt += 1) {
            recordFailure(key, now, store);
        }
        clearFailures(key, store);

        expect(isThrottled(key, now, store)).toBe(false);
    });

    it("첫 번째 전달 IP 주소를 기준으로 시도를 구분한다", () => {
        expect(getAttemptKey(new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7");
        expect(getAttemptKey(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
        expect(getAttemptKey(new Headers())).toBe("unknown");
    });
});

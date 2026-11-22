import { describe, expect, it } from "vitest";
import { signLiveToken, verifyLiveToken } from "@/lib/live/token";

const payload = { b: 7, u: 3, s: "hash", c: "0f8fad5b-d9cb-469f-a165-70867728950e", e: Date.now() + 60_000 };

describe("Live 연결 토큰", () => {
    it("서명한 값을 그대로 돌려준다", () => {
        expect(verifyLiveToken(signLiveToken(payload))).toEqual(payload);
    });

    it("본문을 바꾸거나 서명을 지우면 거절한다", () => {
        const [, signature] = signLiveToken(payload).split(".");
        const forged = Buffer.from(JSON.stringify({ ...payload, u: 1 })).toString("base64url");

        expect(verifyLiveToken(`${forged}.${signature}`)).toBeNull();
        expect(verifyLiveToken(forged)).toBeNull();
        expect(verifyLiveToken(null)).toBeNull();
    });

    it("만료된 토큰은 거절한다", () => {
        expect(verifyLiveToken(signLiveToken({ ...payload, e: Date.now() - 1 }))).toBeNull();
    });
});

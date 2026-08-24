import { createHmac, timingSafeEqual } from "node:crypto";

// 세션 저장소가 없어서 서명한 토큰을 쿠키에 담아 씀 - 서명 키가 AI_PASSWORD라 비밀번호를 바꾸면 기존 쿠키 전부 무효
export const aiSessionCookieName = "meldrift_ai";

// 탭 복구로 세션 쿠키가 되살아나는 경우가 있어서 토큰에도 만료 시간을 넣음
export const aiSessionMaxAgeSeconds = 12 * 60 * 60;

const tokenVersion = "v1";

const getSigningKey = (password: string) => createHmac("sha256", "meldrift-free-ai").update(password).digest();

const sign = (payload: string, password: string) =>
    createHmac("sha256", getSigningKey(password)).update(payload).digest("base64url");

// 길이 차이로 정보가 새지 않게 해시로 길이를 맞춘 뒤 비교
const equals = (left: string, right: string) => {
    const digest = (value: string) => createHmac("sha256", "meldrift-free-compare").update(value).digest();

    return timingSafeEqual(digest(left), digest(right));
};

export const isAiPasswordConfigured = (password = process.env.AI_PASSWORD) =>
    typeof password === "string" && password.length > 0;

// 비밀번호를 설정 안 한 서버는 아무 입력도 통과 안 시킴
export function verifyAiPassword(candidate: unknown, password = process.env.AI_PASSWORD) {
    if (!isAiPasswordConfigured(password) || typeof candidate !== "string" || candidate.length === 0) {
        return false;
    }

    return equals(candidate, password as string);
}

export function createAiSessionToken(
    password = process.env.AI_PASSWORD,
    now = Date.now(),
    maxAgeSeconds = aiSessionMaxAgeSeconds,
) {
    if (!isAiPasswordConfigured(password)) {
        throw new Error("AI_PASSWORD is not configured.");
    }

    const expiresAt = Math.floor(now / 1000) + maxAgeSeconds;
    const payload = `${tokenVersion}.${expiresAt}`;

    return `${payload}.${sign(payload, password as string)}`;
}

// 형식 오류, 서명 불일치, 만료 전부 false - 이유를 구분해 주면 공격자한테 힌트가 됨
export function verifyAiSessionToken(
    token: unknown,
    password = process.env.AI_PASSWORD,
    now = Date.now(),
) {
    if (!isAiPasswordConfigured(password) || typeof token !== "string") {
        return false;
    }

    const parts = token.split(".");

    if (parts.length !== 3) {
        return false;
    }

    const [version, expiresAt, signature] = parts;

    if (version !== tokenVersion || !/^\d+$/.test(expiresAt)) {
        return false;
    }

    if (!equals(signature, sign(`${version}.${expiresAt}`, password as string))) {
        return false;
    }

    return Number(expiresAt) * 1000 > now;
}

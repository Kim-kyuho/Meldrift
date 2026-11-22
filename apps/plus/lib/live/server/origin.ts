// 토큰이 1차 방어선이다. Origin 검사는 다른 사이트의 페이지가 토큰을 손에 넣은 경우를 한 겹 더 막는다.
export function liveOriginAllowed(origin: string | null, host: string | null) {
    // 개발 환경에서는 LAN·Tailscale 주소로도 시험하므로 막지 않는다. 인증은 토큰이 한다.
    if (process.env.NODE_ENV !== "production") {
        return true;
    }
    const configured = (process.env.LIVE_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    if (!origin) {
        return process.env.NODE_ENV !== "production";
    }
    if (configured.includes(origin)) {
        return true;
    }
    if (configured.length === 0 && process.env.NODE_ENV !== "production") {
        return true;
    }
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

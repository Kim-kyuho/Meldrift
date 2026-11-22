import type { NextConfig } from "next";

const plusOrigin = process.env.PLUS_ORIGIN ?? "http://localhost:3001";
// 개발 환경에서는 Live WebSocket도 페이지와 같은 주소로 받아 개발용 Live 서버로 넘긴다.
// LAN·Tailscale 주소나 https 개발 서버에서도 이미 수락한 인증서와 출처를 그대로 쓴다.
// 운영에서는 브라우저가 Plus 배포(NEXT_PUBLIC_LIVE_URL)에 직접 연결하므로 이 규칙이 없다.
const liveDevOrigin = process.env.NODE_ENV === "production"
    ? null
    : process.env.LIVE_DEV_ORIGIN ?? "http://127.0.0.1:3002";
const liveDevRewrites = liveDevOrigin ? [{
    source: "/plus/api/boards/:boardId/live",
    destination: `${liveDevOrigin}/plus/api/boards/:boardId/live`,
}] : [];

const nextConfig: NextConfig = {
    transpilePackages: ["@meldrift/ai", "@meldrift/core", "@meldrift/ui", "@meldrift/board-data"],
    allowedDevOrigins: ['192.168.1.38', 'macbookpro.tail82cf40.ts.net'],
    async rewrites() {
        return {
            beforeFiles: [
                ...liveDevRewrites,
                {
                    source: "/api/:path*",
                    has: [
                        {
                            type: "header",
                            key: "referer",
                            value: ".*/plus(?:/.*)?$",
                        },
                    ],
                    destination: `${plusOrigin}/plus/api/:path*`,
                },
                {
                    source: "/plus",
                    destination: `${plusOrigin}/plus`,
                },
                {
                    source: "/plus/:path*",
                    destination: `${plusOrigin}/plus/:path*`,
                },
            ],
            afterFiles: [],
            fallback: [],
        };
    },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

const plusOrigin = process.env.PLUS_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
    output: "standalone",
    outputFileTracingRoot: path.resolve(__dirname, "../.."),
    transpilePackages: ["@meldrift/ai", "@meldrift/core", "@meldrift/ui", "@meldrift/board-data"],
    allowedDevOrigins: ['192.168.1.38', 'macbookpro.tail82cf40.ts.net'],
    async rewrites() {
        return {
            beforeFiles: [
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

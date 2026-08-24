import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  basePath: process.env.PLUS_STANDALONE === "true" ? undefined : "/plus",
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  /* config options here */
  allowedDevOrigins: ['192.168.1.230', 'macbookpro.tail82cf40.ts.net'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  }
};

export default nextConfig;

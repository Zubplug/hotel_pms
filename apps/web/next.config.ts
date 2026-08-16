import type { NextConfig } from "next";

const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === "true";

const nextConfig: NextConfig = {
  output: isDesktop ? "export" : undefined,
  images: isDesktop ? { unoptimized: true } : undefined,
  // Expose AUTH_SECRET to the Edge runtime (middleware)
  // These env vars are inlined at build time for the Edge runtime
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET || "fallback",
  },
};

export default nextConfig;

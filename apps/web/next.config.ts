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
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

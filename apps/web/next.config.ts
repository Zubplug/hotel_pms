import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Expose AUTH_SECRET to the Edge runtime (middleware)
  // These env vars are inlined at build time for the Edge runtime
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET!,
  },
};

export default nextConfig;

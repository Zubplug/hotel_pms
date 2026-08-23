import type { NextConfig } from "next";

const isDesktop = process.env.NEXT_PUBLIC_IS_DESKTOP === "true";

if (process.env.NODE_ENV === 'production' && !isDesktop) {
  const isDevUrl = (url?: string) => url?.includes('localhost') || url?.includes('127.0.0.1') || url?.includes('0.0.0.0');
  
  if (isDevUrl(process.env.NEXT_PUBLIC_API_URL)) {
    throw new Error('Production build cannot use development endpoints (localhost/127.0.0.1) for NEXT_PUBLIC_API_URL');
  }
}

const nextConfig: NextConfig = {
  output: isDesktop ? "export" : undefined,
  images: isDesktop ? { unoptimized: true } : undefined,
  async rewrites() {
    return [
      {
        source: "/desktop/:path*",
        destination: "https://github.com/Zubplug/hotel_pms/releases/latest/download/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ];
  },
  // Expose AUTH_SECRET to the Edge runtime (middleware)
  // These env vars are inlined at build time for the Edge runtime
  env: {
    AUTH_SECRET: process.env.AUTH_SECRET || "fallback",
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Ignore API routes and middleware (.ts files) when building for Desktop static export
  pageExtensions: isDesktop ? ['tsx', 'jsx'] : ['tsx', 'ts', 'jsx', 'js'],
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.vercel-storage.com' },
      { protocol: 'https', hostname: '*.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'lodgecore.vercel.app' },
      // Common cloud storage providers for LodgeCore-hosted room photos
      { protocol: 'https', hostname: '*.cloudinary.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  env: {
    SITE_NAME: 'Stanzel Grand Resort',
  },
  // Prevent the publishable key from being bundled into client code
  // (it should never have NEXT_PUBLIC_ prefix anyway, but this is extra safety)
  serverExternalPackages: [],
};

export default nextConfig;

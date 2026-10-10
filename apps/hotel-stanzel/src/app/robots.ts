import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stanzelgrandresort.org';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/booking/guest', '/booking/confirm', '/booking/confirmation', '/manage'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

import { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stanzelgrandresort.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/rooms`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/booking`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/dining`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/facilities`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/gallery`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/location`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];
  return staticPages;
}

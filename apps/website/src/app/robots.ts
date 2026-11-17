import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lodgecore.zubplug.com.ng"; return { rules: { userAgent: "*", allow: "/", disallow: ["/portal/", "/api/"] }, sitemap: `${base}/sitemap.xml` }; }

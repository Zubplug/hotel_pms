import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@hotel-pms/db";
import { BookingTemplate } from "./templates";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = await prisma.bookingSite.findFirst({ where: { publicSlug: slug, status: "PUBLISHED" }, select: { siteName: true } });
  return { title: site ? `Book | ${site.siteName}` : "Book a Room", robots: { index: false, follow: false } };
}

export default async function BookingLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [config, site] = await Promise.all([
    prisma.bookingEngineConfig.findFirst({ where: { publicSlug: slug, enabled: true }, select: { propertyId: true } }),
    prisma.bookingSite.findFirst({ where: { publicSlug: slug, status: "PUBLISHED" }, select: { siteName: true, logoUrl: true, primaryColor: true, secondaryColor: true, templateKey: true, content: true } }),
  ]);
  if (!config || !site) notFound();

  const primary = site.primaryColor ?? "#1a56db";
  const secondary = site.secondaryColor ?? "#0e9f6e";
  const tagline = (site.content as { tagline?: string } | null)?.tagline ?? null;
  const cssVars = `:root { --bk-primary: ${primary}; --bk-primary-hover: color-mix(in srgb, ${primary} 85%, white); --bk-primary-dim: color-mix(in srgb, ${primary} 15%, transparent); --bk-secondary: ${secondary}; --bk-bg: #f8faff; --bk-surface: #fff; --bk-border: #e2e8f0; --bk-text: #0f172a; --bk-muted: #64748b; --bk-radius: 10px; --bk-radius-lg: 16px; --bk-shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 32px rgba(0,0,0,.06); } .bk-template-width { max-width: 1080px; margin: 0 auto; padding-left: 24px; padding-right: 24px; } @media (max-width: 720px) { .bk-template-width { padding-left: 16px; padding-right: 16px; } }`;
  return <><style>{cssVars}</style><BookingTemplate templateKey={site.templateKey} siteName={site.siteName} logoUrl={site.logoUrl} tagline={tagline}>{children}</BookingTemplate></>;
}

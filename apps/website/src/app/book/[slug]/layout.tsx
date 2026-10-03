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
  const cssVars = `:root { --bk-primary: ${primary}; --bk-primary-hover: color-mix(in srgb, ${primary} 82%, white); --bk-primary-dim: color-mix(in srgb, ${primary} 15%, transparent); --bk-secondary: ${secondary}; --bk-bg: #07111b; --bk-surface: #0d1b29; --bk-surface-raised: #112336; --bk-border: rgba(167, 205, 218, .15); --bk-text: #edf7fb; --bk-muted: #91a4b5; --bk-radius: 12px; --bk-radius-lg: 20px; --bk-shadow: 0 16px 44px rgba(0,0,0,.22); --bk-shadow-lg: 0 24px 70px rgba(0,0,0,.3); }`;
  return <><style>{cssVars}</style><BookingTemplate templateKey={site.templateKey} siteName={site.siteName} logoUrl={site.logoUrl} tagline={tagline}>{children}</BookingTemplate></>;
}

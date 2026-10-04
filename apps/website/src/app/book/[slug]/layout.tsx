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
  const tagline = (site.content as { tagline?: string } | null)?.tagline ?? null;
  return <BookingTemplate templateKey={site.templateKey} siteName={site.siteName} logoUrl={site.logoUrl} tagline={tagline}>{children}</BookingTemplate>;
}

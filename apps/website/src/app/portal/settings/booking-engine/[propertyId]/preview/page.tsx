import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@hotel-pms/db";

export const dynamic = "force-dynamic";

export default async function BookingEnginePreview({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const site = await prisma.bookingSite.findUnique({ where: { propertyId }, select: { publicSlug: true, status: true, siteName: true } });
  if (!site) notFound();
  const target = `/book/${site.publicSlug}`;
  return <main style={{ padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><div><Link href={`/portal/settings/booking-engine/${propertyId}`}>← Back to settings</Link><h1>Booking site preview</h1><p>Previewing {site.siteName} · {site.status}</p></div><a href={target} target="_blank" rel="noreferrer">Open in new tab ↗</a></div><iframe title="Booking site preview" src={target} style={{ width: "100%", height: "calc(100vh - 150px)", border: "1px solid #d0d5dd", borderRadius: 12 }} /></main>;
}

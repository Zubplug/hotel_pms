import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@hotel-pms/db";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function BookingEnginePreview({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const session = await auth();
  const user = session?.user as { organizationId?: string } | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: user.organizationId }, select: { id: true } });
  if (!property) notFound();
  const [site, config] = await Promise.all([
    prisma.bookingSite.findUnique({ where: { propertyId }, select: { publicSlug: true, status: true, siteName: true } }),
    prisma.bookingEngineConfig.findUnique({ where: { propertyId }, select: { enabled: true, publicSlug: true } }),
  ]);
  if (!site || !config) notFound();
  const ready = config.enabled && site.status === "PUBLISHED" && site.publicSlug === config.publicSlug;
  if (!ready) return <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", color: "#e6edf3", background: "#07111b", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}><Link href={`/portal/settings/booking-engine/${propertyId}`} style={{ color: "#00d4e8", textDecoration: "none" }}>← Back to booking engine</Link><div style={{ marginTop: 32, padding: 28, border: "1px solid rgba(255,255,255,.12)", borderRadius: 16, background: "rgba(255,255,255,.04)" }}><p style={{ color: "#00d4e8", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase" }}>Preview readiness</p><h1 style={{ margin: "10px 0 8px", fontSize: 28 }}>Your booking site is not ready to preview</h1><p style={{ color: "#91a4b5", lineHeight: 1.6 }}>Complete the required steps below, then publish the site to open the guest-facing preview.</p><div style={{ display: "grid", gap: 10, marginTop: 24 }}><div>{config.enabled ? "✓" : "○"} Booking Engine enabled</div><div>{site.status === "PUBLISHED" ? "✓" : "○"} Site published</div><div>{site.publicSlug === config.publicSlug ? "✓" : "○"} Public URL synchronized</div></div><Link href={`/portal/settings/booking-engine/${propertyId}`} style={{ display: "inline-block", marginTop: 24, padding: "10px 15px", borderRadius: 8, background: "#00d4e8", color: "#031018", fontWeight: 700, textDecoration: "none" }}>Open setup</Link></div></main>;
  const target = `/book/${site.publicSlug}`;
  return <main style={{ padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}><div><Link href={`/portal/settings/booking-engine/${propertyId}`}>← Back to settings</Link><h1>Booking site preview</h1><p>Previewing {site.siteName} · {site.status}</p></div><a href={target} target="_blank" rel="noreferrer">Open in new tab ↗</a></div><iframe title="Booking site preview" src={target} style={{ width: "100%", height: "calc(100vh - 150px)", border: "1px solid #d0d5dd", borderRadius: 12 }} /></main>;
}

import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import prisma from "@hotel-pms/db";
import { GuestDetailsForm } from "./GuestDetailsForm";
import { resolveBookingOrigin } from "@/lib/booking-engine/request-origin";

export const dynamic = "force-dynamic";

interface SearchParams {
  checkIn?: string;
  checkOut?: string;
  adults?: string;
  children?: string;
  roomTypeId?: string;
  ratePlanId?: string;
}

export default async function GuestDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { checkIn, checkOut, adults = "2", children = "0", roomTypeId, ratePlanId } = sp;

  if (!checkIn || !checkOut || !roomTypeId || !ratePlanId) redirect(`/book/${slug}`);

  const config = await prisma.bookingEngineConfig.findFirst({
    where: { publicSlug: slug, enabled: true },
    select: { propertyId: true, paymentMode: true },
  });
  if (!config) notFound();

  const [roomType, ratePlan] = await Promise.all([
    prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId: config.propertyId, isActive: true, deletedAt: null },
      select: { name: true, description: true },
    }),
    prisma.ratePlan.findFirst({
      where: { id: ratePlanId, propertyId: config.propertyId, isPublic: true },
      select: { name: true, code: true },
    }),
  ]);

  if (!roomType || !ratePlan) redirect(`/book/${slug}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`);

  let nightlyRate = 0;
  let totalAmount = 0;
  let currency = "NGN";
  let quoteError: string | null = null;

  try {
    // Re-quote from the active deployment's availability API for display
    // accuracy. Do not use a stale booking domain for preview/custom domains.
    const requestHeaders = await headers();
    const origin = resolveBookingOrigin(requestHeaders, process.env.NEXT_PUBLIC_WEBSITE_URL);
    const quoteRes = await fetch(
      `${origin}/api/public/booking/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`,
      { cache: "no-store" }
    );
    const response = await quoteRes.json().catch(() => ({}));
    if (!quoteRes.ok) {
      quoteError = response.error?.message ?? response.error ?? response.message ?? "Unable to confirm the room price";
    } else {
      const data = response.data ?? response;
      const rt = (data.roomTypes ?? []).find((r: any) => r.roomTypeId === roomTypeId);
      const rp = rt?.rates?.find((r: any) => r.ratePlanId === ratePlanId);
      if (rp) {
        nightlyRate = rp.avgNightlyRate;
        totalAmount = rp.subtotal;
        currency = rp.currency;
      } else {
        quoteError = "This room or rate is no longer available. Please search again.";
      }
    }
  } catch (error) {
    console.error("[public-booking] guest quote request failed", { slug, roomTypeId, ratePlanId, error });
    quoteError = "Pricing is temporarily unavailable. Please return to rooms and try again.";
  }

  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  );

  if (quoteError) {
    return (
      <div style={{ maxWidth: 620, margin: "48px auto", textAlign: "center", padding: "36px 28px", background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)" }}>
        <div style={{ fontSize: 34, marginBottom: 14 }}>⌁</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--bk-text)", marginBottom: 10 }}>We need to refresh this room</h1>
        <p style={{ color: "var(--bk-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{quoteError}</p>
        <Link
          href={`/book/${slug}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`}
          className="btn btn-primary"
        >
          ← Return to rooms
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back */}
      <Link
        href={`/book/${slug}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`}
        style={{ fontSize: 12, color: "var(--bk-primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}
      >
        ← Back to rooms
      </Link>

      {/* Step indicator */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 8 }}>
        {[
          { n: 1, label: "Dates" },
          { n: 2, label: "Choose room" },
          { n: 3, label: "Your details", active: true },
          { n: 4, label: "Confirm" },
        ].map((step, i) => (
          <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: step.active ? 1 : 0.4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center",
                background: step.n < 3 ? "#16a34a" : step.active ? "var(--bk-primary)" : "var(--bk-border)",
                color: "#fff",
                fontSize: 11, fontWeight: 800,
              }}>
                {step.n < 3 ? "✓" : step.n}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: step.active ? "var(--bk-text)" : "var(--bk-muted)" }}>
                {step.label}
              </span>
            </div>
            {i < 3 && <div style={{ width: 20, height: 1, background: "var(--bk-border)" }} />}
          </div>
        ))}
      </div>

      <GuestDetailsForm
        slug={slug}
        checkIn={checkIn}
        checkOut={checkOut}
        adults={Number(adults)}
        children={Number(children)}
        nights={nights}
        roomTypeName={roomType.name}
        ratePlanName={ratePlan.name}
        nightlyRate={nightlyRate}
        totalAmount={totalAmount}
        currency={currency}
        roomTypeId={roomTypeId}
        ratePlanId={ratePlanId}
        paymentMode={config.paymentMode}
      />
    </div>
  );
}

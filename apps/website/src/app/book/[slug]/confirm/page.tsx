import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@hotel-pms/db";
import { ConfirmBookingPanel } from "./ConfirmBookingPanel";
import { headers } from "next/headers";
import { resolveBookingOrigin } from "@/lib/booking-engine/request-origin";

export const dynamic = "force-dynamic";

interface SearchParams {
  checkIn?: string; checkOut?: string;
  adults?: string; children?: string;
  roomTypeId?: string; ratePlanId?: string;
  holdToken?: string;
  firstName?: string; lastName?: string;
  email?: string; phone?: string;
  country?: string; specialRequests?: string; eta?: string;
}

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const {
    checkIn, checkOut, adults = "2", children = "0",
    roomTypeId, ratePlanId, holdToken,
    firstName = "", lastName = "", email = "",
    specialRequests = "", eta = "",
  } = sp;

  if (!checkIn || !checkOut || !roomTypeId || !ratePlanId || !holdToken || !email) {
    redirect(`/book/${slug}`);
  }

  const config = await prisma.bookingEngineConfig.findFirst({
    where: { publicSlug: slug, enabled: true },
    select: { propertyId: true, paymentMode: true },
  });
  if (!config) notFound();

  // Verify hold still exists
  const hold = await prisma.bookingHold.findFirst({
    where: { tokenHash: (await import("crypto")).createHash("sha256").update(holdToken).digest("hex"), status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!hold) {
    // Hold expired — redirect with message
    redirect(`/book/${slug}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}&expired=1`);
  }

  const [roomType, ratePlan] = await Promise.all([
    prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId: config.propertyId, isActive: true, deletedAt: null },
      select: { name: true },
    }),
    prisma.ratePlan.findFirst({
      where: { id: ratePlanId, propertyId: config.propertyId },
      select: { name: true },
    }),
  ]);
  if (!roomType || !ratePlan) redirect(`/book/${slug}`);

  let nightlyRate = 0;
  let totalAmount = 0;
  let currency = "NGN";
  let quoteError: string | null = null;
  try {
    // Re-quote from the active deployment for latest pricing.
    const origin = resolveBookingOrigin(await headers(), process.env.NEXT_PUBLIC_WEBSITE_URL);
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
    console.error("[public-booking] confirmation quote request failed", { slug, roomTypeId, ratePlanId, error });
    quoteError = "Pricing is temporarily unavailable. Please return to rooms and try again.";
  }

  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  );

  if (quoteError) {
    return (
      <div style={{ maxWidth: 620, margin: "48px auto", textAlign: "center", padding: "36px 28px", background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)" }}>
        <div style={{ fontSize: 34, marginBottom: 14 }}>⌁</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--bk-text)", marginBottom: 10 }}>We need to refresh this booking</h1>
        <p style={{ color: "var(--bk-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{quoteError}</p>
        <Link href={`/book/${slug}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`} className="btn btn-primary">
          ← Return to rooms
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/book/${slug}/guest?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}&roomTypeId=${roomTypeId}&ratePlanId=${ratePlanId}`}
        style={{ fontSize: 12, color: "var(--bk-primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}
      >
        ← Edit details
      </Link>

      {/* Step indicator */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 8 }}>
        {[
          { n: 1, label: "Dates", done: true },
          { n: 2, label: "Choose room", done: true },
          { n: 3, label: "Your details", done: true },
          { n: 4, label: "Confirm", active: true },
        ].map((step, i) => (
          <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: step.active ? 1 : 0.4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center",
                background: step.done ? "#16a34a" : "var(--bk-primary)",
                color: "#fff", fontSize: 11, fontWeight: 800,
              }}>
                {step.done ? "✓" : step.n}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: step.active || step.done ? "var(--bk-text)" : "var(--bk-muted)" }}>
                {step.label}
              </span>
            </div>
            {i < 3 && <div style={{ width: 20, height: 1, background: "var(--bk-border)" }} />}
          </div>
        ))}
      </div>

      <ConfirmBookingPanel
        slug={slug}
        holdToken={holdToken}
        firstName={firstName}
        lastName={lastName}
        email={email}
        checkIn={checkIn}
        checkOut={checkOut}
        nights={nights}
        adults={Number(adults)}
        children={Number(children)}
        roomTypeName={roomType.name}
        ratePlanName={ratePlan.name}
        totalAmount={totalAmount}
        nightlyRate={nightlyRate}
        currency={currency}
        paymentMode={config.paymentMode}
        specialRequests={specialRequests}
        eta={eta}
      />
    </div>
  );
}

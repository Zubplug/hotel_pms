import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import prisma from "@hotel-pms/db";
import { RoomCard } from "./RoomCard";
import { resolveBookingOrigin } from "@/lib/booking-engine/request-origin";

export const dynamic = "force-dynamic";

interface SearchParams {
  checkIn?: string;
  checkOut?: string;
  adults?: string;
  children?: string;
  roomTypeId?: string;
}

export default async function RoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const { checkIn, checkOut, adults = "2", children = "0", roomTypeId } = sp;

  if (!checkIn || !checkOut || checkIn >= checkOut) {
    redirect(`/book/${slug}`);
  }

  // Validate the engine is still live
  const config = await prisma.bookingEngineConfig.findFirst({
    where: { publicSlug: slug, enabled: true },
    select: { propertyId: true, paymentMode: true, allowedRatePlanIds: true },
  });
  if (!config) notFound();

  let availRooms: any[] = [];
  let availError: string | null = null;

  try {
    // Call the active deployment's public availability API. The environment
    // variable is preferred, but the request host keeps preview/custom-domain
    // deployments from accidentally calling a different booking site.
    const requestHeaders = await headers();
    const origin = resolveBookingOrigin(requestHeaders, process.env.NEXT_PUBLIC_WEBSITE_URL);
    const availRes = await fetch(
      `${origin}/api/public/booking/${slug}/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`,
      { cache: "no-store" }
    );

    const body = await availRes.json().catch(() => ({}));
  if (!availRes.ok) {
      availError = body.error ?? body.message ?? "Unable to fetch availability";
    } else {
      const data = body.data ?? body;
      availRooms = (data.roomTypes ?? []).map((room: any) => ({
        roomTypeId: room.roomTypeId,
        roomTypeName: room.name,
        description: room.description,
        amenities: room.amenities ?? [],
        images: room.photos ?? [],
        maxOccupancy: room.maxOccupancy,
        availableRooms: room.availability?.available ?? 0,
        rates: (room.rates ?? []).map((rate: any) => ({
          ratePlanId: rate.ratePlanId,
          ratePlanName: rate.ratePlanName,
          ratePlanCode: rate.ratePlanCode ?? "",
          nightlyRate: rate.avgNightlyRate,
          totalAmount: rate.subtotal,
          currency: rate.currency,
        })),
      }));
    }
  } catch (error) {
    console.error("[public-booking] availability request failed", { slug, checkIn, checkOut, error });
    availError = "Availability is temporarily unavailable. Please try again in a moment.";
  }

  if (roomTypeId) {
    availRooms = availRooms.filter((room) => room.roomTypeId === roomTypeId);

    const selectedRoom = availRooms[0];
    const selectedRate = selectedRoom?.rates
      ?.slice()
      .sort((a: any, b: any) => a.nightlyRate - b.nightlyRate)[0];

    if (selectedRoom?.availableRooms > 0 && selectedRate) {
      const guestParams = new URLSearchParams({
        checkIn,
        checkOut,
        adults,
        children,
        roomTypeId,
        ratePlanId: selectedRate.ratePlanId,
      });
      redirect(`/book/${slug}/guest?${guestParams.toString()}`);
    }
  }

  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  );

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div>
      {/* ── STEP HEADER ─────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        {/* Breadcrumb */}
        <Link
          href={`/book/${slug}`}
          style={{ fontSize: 12, color: "var(--bk-primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
        >
          ← Modify search
        </Link>

        {/* Stay summary */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            background: "var(--bk-surface)",
            border: "1px solid var(--bk-border)",
            borderRadius: "var(--bk-radius)",
            padding: "14px 20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--bk-muted)", marginBottom: 3 }}>Check-in</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--bk-text)" }}>{fmtDate(checkIn)}</div>
          </div>
          <div style={{ width: 32, height: 1, background: "var(--bk-border)" }} />
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--bk-muted)", marginBottom: 3 }}>Check-out</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--bk-text)" }}>{fmtDate(checkOut)}</div>
          </div>
          <div style={{ width: 32, height: 1, background: "var(--bk-border)" }} />
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--bk-muted)", marginBottom: 3 }}>Guests</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--bk-text)" }}>
              {adults} adult{Number(adults) !== 1 ? "s" : ""}{Number(children) > 0 ? `, ${children} child${Number(children) !== 1 ? "ren" : ""}` : ""}
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span
              style={{
                background: "var(--bk-primary-dim)",
                color: "var(--bk-primary)",
                border: "1px solid color-mix(in srgb, var(--bk-primary) 25%, transparent)",
                borderRadius: 999,
                padding: "4px 14px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}
            >
              {nights} night{nights !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { n: 1, label: "Dates" },
            { n: 2, label: "Choose room", active: true },
            { n: 3, label: "Your details" },
            { n: 4, label: "Confirm" },
          ].map((step, i) => (
            <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                opacity: step.active ? 1 : 0.4,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: step.active ? "var(--bk-primary)" : "var(--bk-border)",
                  color: step.active ? "#fff" : "var(--bk-muted)",
                  fontSize: 11, fontWeight: 800,
                }}>
                  {step.n}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: step.active ? "var(--bk-text)" : "var(--bk-muted)" }}>
                  {step.label}
                </span>
              </div>
              {i < 3 && <div style={{ width: 20, height: 1, background: "var(--bk-border)" }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── ERROR STATE ─────────────────────────────────────── */}
      {availError && (
        <div style={{ padding: "20px 24px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--bk-radius)", fontSize: 14, color: "#dc2626", marginBottom: 24 }}>
          {availError}
        </div>
      )}

      {/* ── ROOM RESULTS ───────────────────────────────────── */}
      {!availError && availRooms.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🏨</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--bk-text)", marginBottom: 8 }}>
            No rooms available
          </h2>
          <p style={{ fontSize: 14, color: "var(--bk-muted)", marginBottom: 20 }}>
            No rooms are available for your selected dates. Try adjusting your dates.
          </p>
          <Link href={`/book/${slug}`} className="btn btn-outline btn-sm">
            ← Choose different dates
          </Link>
        </div>
      )}

      {!availError && availRooms.length > 0 && (
        <div>
          <div style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "-.04em", color: "var(--bk-text)" }}>
              Room availability
            </h2>
            <span style={{ fontSize: 13, color: "var(--bk-muted)" }}>
              {availRooms.length} room type{availRooms.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {availRooms.map((room: any) => (
              <RoomCard
                key={room.roomTypeId}
                room={room}
                slug={slug}
                checkIn={checkIn}
                checkOut={checkOut}
                adults={adults}
                children={children}
                nights={nights}
                paymentMode={config.paymentMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

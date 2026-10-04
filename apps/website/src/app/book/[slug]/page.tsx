import { notFound } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@hotel-pms/db";
import { DateSearchForm } from "./DateSearchForm";
import { resolveBookingOrigin } from "@/lib/booking-engine/request-origin";

export const dynamic = "force-dynamic";

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface SearchParams {
  roomTypeId?: string;
}

interface LiveRoomPreview {
  available: number;
  rate?: { nightlyRate: number; currency: string };
}

interface BookingContent {
  tagline?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  amenities?: string[];
  cancellationText?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export default async function BookingLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { roomTypeId: selectedRoomTypeId } = await searchParams;

  const [config, site, roomTypes] = await Promise.all([
    prisma.bookingEngineConfig.findFirst({
      where: { publicSlug: slug, enabled: true },
      select: {
        propertyId: true,
        paymentMode: true,
        minStay: true,
        maxStay: true,
        bookingLeadTimeHours: true,
        maxAdvanceDays: true,
      },
    }),
    prisma.bookingSite.findFirst({
      where: { publicSlug: slug, status: "PUBLISHED" },
      select: { siteName: true, content: true, primaryColor: true },
    }),
    // Fetch room types for the "What we offer" section
    prisma.roomType.findMany({
      where: {
        property: { bookingEngineConfig: { publicSlug: slug, enabled: true } },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        maxAdults: true,
        maxOccupancy: true,
        baseRate: true,
        currency: true,
        photos: true,
        amenities: true,
      },
      take: 6,
      orderBy: { name: "asc" },
    }),
  ]);

  if (!config || !site) notFound();

  const previewCheckIn = addDays(new Date(`${today()}T00:00:00`), Math.ceil(config.bookingLeadTimeHours / 24));
  const previewCheckOut = addDays(new Date(`${previewCheckIn}T00:00:00`), config.minStay);
  const liveRooms = new Map<string, LiveRoomPreview>();

  try {
    const origin = resolveBookingOrigin(await headers(), process.env.NEXT_PUBLIC_WEBSITE_URL);
    const inventoryRes = await fetch(
      `${origin}/api/public/booking/${slug}/availability?checkIn=${previewCheckIn}&checkOut=${previewCheckOut}&adults=2&children=0`,
      { cache: "no-store" }
    );
    const response = await inventoryRes.json().catch(() => ({}));
    if (inventoryRes.ok) {
      const data = response.data ?? response;
      for (const room of data.roomTypes ?? []) {
        const rates = (room.rates ?? []) as { avgNightlyRate: number; currency: string }[];
        const lowestRate = [...rates].sort((a, b) => a.avgNightlyRate - b.avgNightlyRate)[0];
        liveRooms.set(room.roomTypeId, {
          available: room.availability?.available ?? 0,
          rate: lowestRate ? { nightlyRate: lowestRate.avgNightlyRate, currency: lowestRate.currency } : undefined,
        });
      }
    }
  } catch (error) {
    console.error("[public-booking] landing inventory request failed", { slug, error });
  }

  const content = (site.content && typeof site.content === "object" ? site.content : {}) as BookingContent;
  const heroTitle = content.heroTitle?.trim() || content.tagline?.trim() || "Experience comfort and elegance";
  const heroSubtitle = content.heroSubtitle?.trim() || "Book directly with us for the best rates and a personalised experience.";
  const propertyAmenities = Array.isArray(content.amenities) ? content.amenities.filter((amenity): amenity is string => typeof amenity === "string" && amenity.trim().length > 0) : [];
  const cancellationText = content.cancellationText?.trim();
  const contactPhone = content.contactPhone?.trim();
  const contactEmail = content.contactEmail?.trim();

  return (
    <div>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <div
        className="bk-landing-hero"
        style={{
          textAlign: "center",
          padding: "60px 0 40px",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bk-primary-dim)",
            border: "1px solid color-mix(in srgb, var(--bk-primary) 25%, transparent)",
            borderRadius: 999,
            padding: "4px 14px",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--bk-primary)",
            letterSpacing: ".06em",
            textTransform: "uppercase",
            marginBottom: 20,
            fontFamily: "var(--font-mono)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--bk-primary)", display: "inline-block" }} />
          Direct booking — Best rate guaranteed
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
            fontWeight: 800,
            letterSpacing: "-.05em",
            color: "var(--bk-text)",
            lineHeight: 1.05,
            marginBottom: 14,
          }}
        >
          {heroTitle}
        </h1>
        <p style={{ fontSize: 16, color: "var(--bk-muted)", maxWidth: 480, margin: "0 auto 36px" }}>
          {heroSubtitle}
        </p>
      </div>

      {/* ── SEARCH FORM ───────────────────────────────────────── */}
      <DateSearchForm
        slug={slug}
        roomTypeId={selectedRoomTypeId}
        config={{
          minStay: config.minStay,
          maxStay: config.maxStay,
          bookingLeadTimeHours: config.bookingLeadTimeHours,
          maxAdvanceDays: config.maxAdvanceDays,
          paymentMode: config.paymentMode,
        }}
      />

      {/* ── ROOM TYPE PREVIEW ─────────────────────────────────── */}
      {roomTypes.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--bk-primary)", marginBottom: 6 }}>
                Our Accommodation
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  letterSpacing: "-.04em",
                  color: "var(--bk-text)",
                }}
              >
                Room Types
              </h2>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {roomTypes.map((rt) => {
              const images = (rt.photos ?? []) as string[];
              const amenities = (rt.amenities ?? []) as string[];
              const liveRoom = liveRooms.get(rt.id);
              const displayRate = liveRoom?.rate ?? (Number(rt.baseRate) > 0 ? { nightlyRate: Number(rt.baseRate), currency: rt.currency } : undefined);
              const inventoryLabel = liveRoom
                ? liveRoom.available > 0 ? `${liveRoom.available} available` : "Sold out"
                : "Live availability on search";

              return (
                <div
                  key={rt.id}
                  style={{
                    background: "var(--bk-surface)",
                    border: `1px solid ${selectedRoomTypeId === rt.id ? "var(--bk-primary)" : "var(--bk-border)"}`,
                    borderRadius: "var(--bk-radius-lg)",
                    overflow: "hidden",
                    boxShadow: "var(--bk-shadow)",
                    transition: "transform .2s, box-shadow .2s",
                  }}
                  className="bk-room-card"
                >
                  {/* Image */}
                  <div
                    style={{
                      height: 180,
                      background: images[0]
                        ? `url(${images[0]}) center/cover no-repeat`
                        : "linear-gradient(135deg, var(--bk-primary-dim), color-mix(in srgb, var(--bk-primary) 8%, transparent))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {!images[0] && (
                      <span style={{ fontSize: 36, opacity: 0.3 }}>🏨</span>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: "18px 20px" }}>
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 16,
                        letterSpacing: "-.03em",
                        color: "var(--bk-text)",
                        marginBottom: 6,
                      }}
                    >
                      {rt.name}
                    </h3>
                    {rt.description && (
                      <p style={{ fontSize: 13, color: "var(--bk-muted)", lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {rt.description}
                      </p>
                    )}

                    {/* Occupancy + amenities */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      <span style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", color: "var(--bk-muted)", fontWeight: 600 }}>
                        👤 Up to {rt.maxOccupancy} guests
                      </span>
                      <span style={{ fontSize: 11, background: liveRoom?.available ? "rgba(90,240,174,.1)" : "rgba(248,113,113,.1)", borderRadius: 6, padding: "3px 8px", color: liveRoom?.available ? "#5af0ae" : liveRoom ? "#fca5a5" : "var(--bk-muted)", fontWeight: 700 }}>
                        {inventoryLabel}
                      </span>
                      {amenities.slice(0, 3).map((a) => (
                        <span key={a} style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", color: "var(--bk-muted)", fontWeight: 600 }}>
                          {a}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <span style={{ display: "block", fontSize: 10, color: "var(--bk-muted)", textTransform: "uppercase", letterSpacing: ".1em", fontFamily: "var(--font-mono)" }}>From</span>
                        {displayRate ? (
                          <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, letterSpacing: "-.04em", color: "var(--bk-text)" }}>
                            {fmtCurrency(displayRate.nightlyRate, displayRate.currency)} <span style={{ fontSize: 11, fontWeight: 500, color: "var(--bk-muted)", letterSpacing: 0 }}>/ night</span>
                          </span>
                        ) : (
                          <span style={{ display: "block", marginTop: 3, fontSize: 13, fontWeight: 700, color: "var(--bk-muted)" }}>Pricing on request</span>
                        )}
                      </div>
                      <a href={`/book/${slug}/rooms?checkIn=${previewCheckIn}&checkOut=${previewCheckOut}&adults=2&children=0&roomTypeId=${encodeURIComponent(rt.id)}`} style={{ fontSize: 11, fontWeight: 600, color: "var(--bk-primary)", textAlign: "right", textDecoration: "none" }}>
                        Book this room →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── WHY BOOK DIRECT ────────────────────────────────────── */}
      <section style={{ marginTop: 64, padding: "40px", background: "var(--bk-surface)", borderRadius: "var(--bk-radius-lg)", border: "1px solid var(--bk-border)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
            letterSpacing: "-.04em",
            color: "var(--bk-text)",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          Why book directly with us?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
          {[
            { icon: "💳", title: "Best Rate", desc: "We guarantee the lowest rate when you book with us directly." },
            { icon: "⚡", title: "Instant Confirmation", desc: "Get your booking confirmation immediately after reserving." },
            { icon: "🔒", title: "Secure & Private", desc: "Your data is encrypted and never shared with third parties." },
            { icon: "🎁", title: "Direct Perks", desc: "Exclusive offers and upgrades only available to direct guests." },
          ].map((item) => (
            <div key={item.title} style={{ textAlign: "center", padding: "20px 16px" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--bk-text)", marginBottom: 6 }}>{item.title}</div>
              <p style={{ fontSize: 12, color: "var(--bk-muted)", lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {(propertyAmenities.length > 0 || cancellationText || contactPhone || contactEmail) && (
        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {propertyAmenities.length > 0 && (
            <div style={{ padding: "28px", background: "var(--bk-surface)", borderRadius: "var(--bk-radius-lg)", border: "1px solid var(--bk-border)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--bk-primary)", marginBottom: 8 }}>At your stay</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-.04em", color: "var(--bk-text)", marginBottom: 18 }}>Thoughtful essentials</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {propertyAmenities.map((amenity) => (
                  <div key={amenity} style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--bk-muted)", fontSize: 13 }}>
                    <span style={{ display: "inline-flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "var(--bk-primary-dim)", color: "var(--bk-primary)", fontSize: 12 }}>✓</span>
                    {amenity}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(cancellationText || contactPhone || contactEmail) && (
            <div style={{ padding: "28px", background: "var(--bk-surface)", borderRadius: "var(--bk-radius-lg)", border: "1px solid var(--bk-border)" }}>
              {cancellationText && <>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--bk-primary)", marginBottom: 8 }}>Before you book</div>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-.04em", color: "var(--bk-text)", marginBottom: 10 }}>Cancellation policy</h2>
                <p style={{ color: "var(--bk-muted)", fontSize: 13, lineHeight: 1.65, marginBottom: contactPhone || contactEmail ? 20 : 0 }}>{cancellationText}</p>
              </>}
              {(contactPhone || contactEmail) && <div style={{ borderTop: cancellationText ? "1px solid var(--bk-border)" : undefined, paddingTop: cancellationText ? 18 : 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--bk-primary)", marginBottom: 8 }}>Need help?</div>
                <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  {contactPhone && <a href={`tel:${contactPhone}`} style={{ color: "var(--bk-text)", textDecoration: "none" }}>{contactPhone}</a>}
                  {contactEmail && <a href={`mailto:${contactEmail}`} style={{ color: "var(--bk-text)", textDecoration: "none" }}>{contactEmail}</a>}
                </div>
              </div>}
            </div>
          )}
        </section>
      )}

      <style>{`
        .bk-room-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,.1); }
      `}</style>
    </div>
  );
}

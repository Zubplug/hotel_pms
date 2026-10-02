import { notFound } from "next/navigation";
import prisma from "@hotel-pms/db";
import { DateSearchForm } from "./DateSearchForm";

export const dynamic = "force-dynamic";

export default async function BookingLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
      },
      select: {
        id: true,
        name: true,
        description: true,
        maxAdults: true,
        maxOccupancy: true,
        photos: true,
        amenities: true,
      },
      take: 6,
      orderBy: { name: "asc" },
    }),
  ]);

  if (!config || !site) notFound();

  const tagline = (site.content as { tagline?: string } | null)?.tagline ?? "Experience comfort and elegance";

  return (
    <div>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <div
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
          {tagline}
        </h1>
        <p style={{ fontSize: 16, color: "var(--bk-muted)", maxWidth: 480, margin: "0 auto 36px" }}>
          Book directly with us for the best rates and a personalised experience.
        </p>
      </div>

      {/* ── SEARCH FORM ───────────────────────────────────────── */}
      <DateSearchForm
        slug={slug}
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

              return (
                <div
                  key={rt.id}
                  style={{
                    background: "var(--bk-surface)",
                    border: "1px solid var(--bk-border)",
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
                      {amenities.slice(0, 3).map((a) => (
                        <span key={a} style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", color: "var(--bk-muted)", fontWeight: 600 }}>
                          {a}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "var(--bk-muted)" }}>From</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--bk-primary)" }}>Select dates to see pricing →</span>
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

      <style>{`
        .bk-room-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,.1); }
      `}</style>
    </div>
  );
}

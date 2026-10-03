import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";
import { BookingEngineSetupButton } from "./BookingEngineSetupButton";

export const dynamic = "force-dynamic";

type SessionUser = { organizationId?: string; name?: string | null; email?: string | null };

export default async function BookingEngineOverviewPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.organizationId) redirect("/portal/login");
  const { organizationId } = user;

  // Fetch all properties for this org
  const properties = await prisma.property.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // For each property, check if Booking Engine entitlement is active and load config
  const propertyData = await Promise.all(
    properties.map(async (prop) => {
      const [entitled, config, site] = await Promise.all([
        prisma.entitlement.findFirst({
          where: {
            organizationId,
            OR: [{ propertyId: prop.id }, { propertyId: null }],
            productCode: "ADDON_BOOKING_ENGINE",
            status: "ACTIVE",
          },
          select: { id: true },
        }),
        prisma.bookingEngineConfig.findUnique({
          where: { propertyId: prop.id },
          select: { enabled: true, publicSlug: true, paymentMode: true },
        }),
        prisma.bookingSite.findUnique({
          where: { propertyId: prop.id },
          select: { status: true, siteName: true },
        }),
      ]);
      return { ...prop, entitled: !!entitled, config, site };
    })
  );

  const liveCount = propertyData.filter(
    (p) => p.config?.enabled && p.site?.status === "PUBLISHED"
  ).length;

  return (
    <PortalShell orgName={undefined} userName={user.name ?? user.email ?? undefined}>
      {/* ── PAGE HEADER ──────────────────────────────────── */}
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Booking Engine</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            Configure your public online booking sites — one per property.
          </p>
        </div>
      </div>

      {/* ── SUMMARY STRIP ──────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total Properties", value: String(properties.length), color: "#00d4e8" },
          { label: "Addon Activated", value: String(propertyData.filter((p) => p.entitled).length), color: "#a78bfa" },
          { label: "Live Sites", value: String(liveCount), color: "#3ef5a0" },
        ].map((s) => (
          <div
            key={s.label}
            className="portal-card"
            style={{ padding: "16px 20px", position: "relative", overflow: "hidden" }}
          >
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: s.color, opacity: 0.7,
              }}
            />
            <div
              style={{
                fontFamily: "var(--font-display)", fontSize: "2rem",
                fontWeight: 800, letterSpacing: "-.06em",
                color: s.color, lineHeight: 1, marginBottom: 4,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── PROPERTY LIST ──────────────────────────────── */}
      <div
        style={{
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".18em",
          textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12,
        }}
      >
        Properties
      </div>

      {propertyData.length === 0 && (
        <div className="portal-card" style={{ textAlign: "center", padding: "36px 24px" }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.4 }}>🏨</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            No active properties
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Add and activate properties before setting up the Booking Engine.
          </p>
          <Link href="/portal/properties" className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>
            View properties →
          </Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {propertyData.map((prop) => {
          const isLive = prop.config?.enabled && prop.site?.status === "PUBLISHED";
          const bookingUrl = prop.config?.publicSlug
            ? `https://book.lodgecore.com/book/${prop.config.publicSlug}`
            : null;

          return (
            <div
              key={prop.id}
              className="portal-card"
              style={{
                display: "flex", alignItems: "center",
                gap: 20, padding: "16px 20px", flexWrap: "wrap",
              }}
            >
              {/* Status dot */}
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                  background: isLive ? "#3ef5a0" : prop.entitled ? "#ffbe5a" : "#4e6678",
                }}
              />

              {/* Property name + url */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)", fontWeight: 700,
                    color: "var(--text-primary)", fontSize: 14,
                  }}
                >
                  {prop.name}
                </div>
                {bookingUrl ? (
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 11,
                      color: "var(--accent)", textDecoration: "none",
                    }}
                  >
                    {bookingUrl}
                  </a>
                ) : (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                    Not configured
                  </span>
                )}
              </div>

              {/* Badges */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                {!prop.entitled && (
                  <span className="portal-badge badge-inactive">No addon</span>
                )}
                {prop.entitled && !prop.config && (
                  <span className="portal-badge badge-pending">Setup needed</span>
                )}
                {prop.config && !isLive && (
                  <span className="portal-badge badge-pending">Draft</span>
                )}
                {isLive && (
                  <span className="portal-badge badge-active">Live</span>
                )}
                {prop.config?.paymentMode && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em",
                      textTransform: "uppercase", padding: "3px 8px",
                      border: "1px solid var(--border)", borderRadius: 4,
                      color: "var(--text-muted)", background: "var(--bg-overlay)",
                    }}
                  >
                    {prop.config.paymentMode.replace("_", " ")}
                  </span>
                )}
              </div>

              {/* Configure CTA */}
              <BookingEngineSetupButton propertyId={prop.id} entitled={prop.entitled} configured={Boolean(prop.config)} />
            </div>
          );
        })}
      </div>

      {/* ── HELP STRIP ──────────────────────────────── */}
      <div
        style={{
          marginTop: 24, padding: "14px 20px",
          border: "1px solid var(--border-card)", borderRadius: "var(--radius-lg)",
          background: "var(--bg-overlay)", fontSize: 12, color: "var(--text-muted)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}
      >
        <span>
          Each property gets its own booking page at{" "}
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
            book.lodgecore.com/[your-slug]
          </span>
        </span>
        <Link href="/portal/support" className="btn btn-outline btn-sm">
          Contact support →
        </Link>
      </div>
    </PortalShell>
  );
}

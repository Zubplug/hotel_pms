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
            productCode: { in: ["ADDON_BOOKING_ENGINE", "ADDON_CUSTOM_WEBSITE_API", "ADDON_CUSTOM_WEBSITE_PMS"] },
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
      <div className="be-page-hero">
        <div>
          <div className="portal-page-kicker">Distribution · Direct revenue</div>
          <h1 className="portal-page-title">Booking Engine</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            Manage direct booking experiences, rate visibility and publishing for every property.
          </p>
        </div>
        <div className="be-hero-mark" aria-hidden="true"><span>↗</span></div>
      </div>

      {/* ── SUMMARY STRIP ──────────────────────────────── */}
      <div className="be-stat-grid">
        {[
          { label: "Total Properties", value: String(properties.length), color: "#00d4e8" },
          { label: "Addon Activated", value: String(propertyData.filter((p) => p.entitled).length), color: "#a78bfa" },
          { label: "Live Sites", value: String(liveCount), color: "#3ef5a0" },
        ].map((s) => (
          <div
            key={s.label}
            className="portal-card be-stat-card"
          >
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
      <div className="be-section-heading">
        <div><span className="be-section-index">01</span> Properties</div>
        <span>{propertyData.length} active properties</span>
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

      <div className="be-property-list">
        {propertyData.map((prop) => {
          const isLive = prop.config?.enabled && prop.site?.status === "PUBLISHED";
          const bookingUrl = prop.config?.publicSlug
            ? `https://book.lodgecore.com/book/${prop.config.publicSlug}`
            : null;

          return (
            <div
              key={prop.id}
              className="portal-card be-property-card"
            >
              <div className={`be-property-status ${isLive ? "is-live" : prop.entitled ? "is-ready" : ""}`} />

              {/* Property name + url */}
              <div className="be-property-main">
                <div
                  className="be-property-name"
                >
                  {prop.name}
                </div>
                {bookingUrl ? (
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                      className="be-property-url"
                  >
                    {bookingUrl}
                  </a>
                ) : (
                  <span className="be-property-url muted">
                    Not configured
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className="be-property-meta">
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
                  <span className="be-payment-pill">
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
        className="be-help-strip"
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

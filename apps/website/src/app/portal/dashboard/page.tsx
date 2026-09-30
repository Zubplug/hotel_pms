import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@hotel-pms/db";
import { PortalShell } from "@/components/portal-shell";

type SessionUser = { organizationId?: string; name?: string | null; email?: string | null };

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  const map: Record<string, { cls: string; label: string; dot: string }> = {
    ACTIVE:   { cls: "badge-active",   label: "Active",   dot: "#3ef5a0" },
    TRIALING: { cls: "badge-pending",  label: "Trial",    dot: "#ffbe5a" },
    PAST_DUE: { cls: "badge-urgent",   label: "Past Due", dot: "#ff5f72" },
    CANCELED: { cls: "badge-inactive", label: "Canceled", dot: "#4e6678" },
  };
  const b = map[s] ?? { cls: "badge-inactive", label: status, dot: "#4e6678" };
  return (
    <span className={`portal-badge ${b.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: b.dot, display: "inline-block", flexShrink: 0 }} />
      {b.label}
    </span>
  );
}

const AREA_CARDS = [
  { href: "/portal/subscription",   icon: "⬡",  label: "Subscription",   desc: "Plan, modules and usage details",        color: "#00d4e8" },
  { href: "/portal/properties",     icon: "🏨", label: "Properties",     desc: "Active properties and their scope",       color: "#3ef5a0" },
  { href: "/portal/implementation", icon: "🚀", label: "Implementation", desc: "Migration and installation progress",     color: "#a78bfa" },
  { href: "/portal/hardware",       icon: "🔧", label: "Hardware",       desc: "Installed devices and pending items",     color: "#ffbe5a" },
  { href: "/portal/integrations",   icon: "⟳",  label: "Integrations",  desc: "Connected systems and API access",        color: "#ff8c60" },
  { href: "/portal/support",        icon: "◎",  label: "Support",        desc: "Open tickets, SLA and help resources",    color: "#3ef5a0" },
  { href: "/portal/billing",        icon: "◇",  label: "Billing",        desc: "Invoices, payments and statements",       color: "#00d4e8" },
  { href: "/portal/settings",       icon: "⚙",  label: "Settings",       desc: "Organisation and user management",        color: "#a78bfa" },
];

export default async function PortalDashboard() {
  const session = await auth();
  const user = session?.user as SessionUser & { isLodgeCoreAdmin?: boolean } | undefined;
  if (user?.isLodgeCoreAdmin) redirect("/hq");
  if (!user?.organizationId) redirect("/portal/login");

  const { organizationId } = user;

  const [org, subscription, properties, openTickets, hardware, pendingInstalls] =
    await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, slug: true } }),
      prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        include: { plan: { select: { name: true } } },
      }),
      prisma.property.count({ where: { organizationId, isActive: true } }),
      prisma.supportTicket.count({ where: { organizationId, status: { not: "CLOSED" } } }),
      prisma.hardwareInventory.count({ where: { organizationId } }),
      prisma.hardwareInstallation.count({ where: { organizationId, status: { not: "COMPLETED" } } }),
    ]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (user.name || user.email || "").split(/[ @]/)[0];
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const STATS = [
    {
      label: "Current Plan",
      value: subscription?.plan?.name ?? "—",
      sub: subscription?.status ? null : "No active subscription",
      badge: subscription?.status ? <StatusBadge status={subscription.status} /> : null,
      icon: "⬡",
      color: "#00d4e8",
      href: "/portal/subscription",
    },
    {
      label: "Active Properties",
      value: String(properties),
      sub: "Registered and live",
      badge: null,
      icon: "🏨",
      color: "#3ef5a0",
      href: "/portal/properties",
    },
    {
      label: "Open Support",
      value: String(openTickets),
      sub: openTickets === 0 ? "No open tickets" : `${openTickets} ticket${openTickets > 1 ? "s" : ""} open`,
      badge: null,
      icon: "◎",
      color: openTickets > 0 ? "#ff5f72" : "#3ef5a0",
      href: "/portal/support",
    },
    {
      label: "Hardware Items",
      value: String(hardware),
      sub: pendingInstalls > 0 ? `${pendingInstalls} install${pendingInstalls > 1 ? "s" : ""} in progress` : "All installed",
      badge: null,
      icon: "🔧",
      color: "#ffbe5a",
      href: "/portal/hardware",
    },
  ];

  return (
    <PortalShell orgName={org?.name} userName={user.name ?? user.email ?? undefined}>
      {/* ── PAGE HEADER ──────────────────────────────────── */}
      <div style={{ marginBottom: 36 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".18em",
          textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8,
        }}>
          {dateStr}
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem,3vw,2.2rem)",
          fontWeight: 800, letterSpacing: "-.05em", color: "var(--text-primary)", marginBottom: 8,
        }}>
          {greeting}, {firstName} 👋
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{org?.name ?? "Your organisation"}</span>
          {subscription?.status && (
            <>
              <span style={{ color: "var(--border)" }}>·</span>
              <StatusBadge status={subscription.status} />
            </>
          )}
          {pendingInstalls > 0 && (
            <>
              <span style={{ color: "var(--border)" }}>·</span>
              <span style={{ color: "var(--amber)" }}>
                {pendingInstalls} installation{pendingInstalls !== 1 ? "s" : ""} in progress
              </span>
            </>
          )}
        </p>
      </div>

      {/* ── STATS ROW ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {STATS.map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none" }}>
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border-card)",
              borderRadius: "var(--radius-lg)", padding: "20px 20px 18px",
              position: "relative", overflow: "hidden",
              transition: "border-color .25s, transform .25s",
            }}
              className="portal-stat-card"
            >
              {/* Colour accent bar */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: s.color, opacity: .7,
              }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "var(--radius-md)",
                  background: `${s.color}12`,
                  border: `1px solid ${s.color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                {s.badge}
              </div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: "1.8rem",
                fontWeight: 800, letterSpacing: "-.06em",
                color: s.color, lineHeight: 1, marginBottom: 4,
              }}>
                {s.value}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-.02em", marginBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{s.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── QUICK ACTIONS ─────────────────────────────────── */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-card)",
        borderRadius: "var(--radius-lg)", padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 16, marginBottom: 28,
      }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.03em", marginBottom: 3 }}>
            Quick Actions
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Access your most-used portal areas in one click.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/portal/support" className="btn btn-primary btn-sm" style={{ border: "none" }}>Open a ticket →</Link>
          <Link href="/portal/properties" className="btn btn-outline btn-sm">View properties</Link>
          <Link href="/portal/implementation" className="btn btn-outline btn-sm">Implementation</Link>
          <Link href="/portal/billing" className="btn btn-outline btn-sm">Billing</Link>
        </div>
      </div>

      {/* ── WORKSPACE GRID ────────────────────────────────── */}
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".18em",
        textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14,
      }}>
        Workspace Areas
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {AREA_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: "flex", flexDirection: "column", gap: 10,
              padding: "18px 18px 16px",
              border: "1px solid var(--border-card)",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-card)",
              textDecoration: "none",
              position: "relative", overflow: "hidden",
              transition: "border-color .2s, transform .2s",
            }}
            className="portal-area-card"
          >
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 1,
              background: `linear-gradient(90deg, transparent, ${card.color}50, transparent)`,
              opacity: 0, transition: "opacity .2s",
            }} className="portal-area-card-line" />
            <div style={{
              width: 32, height: 32, borderRadius: "var(--radius-sm)",
              background: `${card.color}12`,
              border: `1px solid ${card.color}20`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.03em", marginBottom: 3 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {card.desc}
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: card.color, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Open →
            </div>
          </Link>
        ))}
      </div>

      {/* ── FOOTER HELP STRIP ─────────────────────────────── */}
      <div style={{
        marginTop: 28, padding: "18px 24px",
        border: "1px solid var(--border-card)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-overlay)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Need technical help? The LodgeCore Care team is available during business hours.
          {" "}<Link href="/portal/support" style={{ color: "var(--accent)" }}>Raise a support ticket →</Link>
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {["PMS", "Access", "Smart", "Systems", "Care"].map((d) => (
            <span key={d} style={{
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em",
              textTransform: "uppercase", padding: "3px 8px",
              border: "1px solid var(--border)", borderRadius: 4,
              color: "var(--text-muted)", background: "var(--bg-overlay)",
            }}>{d}</span>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}

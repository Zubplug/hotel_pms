import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Hospitality — Complete Hotel Management Software Platform",
  description: "The complete hospitality technology platform. PMS, POS, booking engine, accounting, housekeeping, events and multi-property management. Built for hotels, resorts and serviced apartments.",
};

const MODULES = [
  { href: "/hospitality/pms",            img: "/icon-pms.png",          name: "Property Management",   desc: "Front desk, reservations, room management, guest folios and automated check-in/out.",          tags: ["Reservations", "Front Desk", "Room Status", "Folios"] },
  { href: "/hospitality/pos",            img: "/icon-pos.png",          name: "Point of Sale",         desc: "Restaurant, bar, spa and room-service POS with automatic real-time folio posting.",            tags: ["F&B", "Bar", "Spa", "Room Service"] },
  { href: "/hospitality/booking",        img: "/icon-booking.png",      name: "Booking Engine",         desc: "Direct online booking with live rate management and multi-OTA channel synchronisation.",        tags: ["Direct Booking", "OTA Sync", "Rate Management"] },
  { href: "/hospitality/accounting",     img: "/icon-finance.png",      name: "Finance & Accounting",  desc: "Folios, invoicing, cash management, night audit and complete financial reporting.",             tags: ["Night Audit", "Invoicing", "Cash", "Reports"] },
  { href: "/hospitality/housekeeping",   img: "/icon-housekeeping.png", name: "Housekeeping",           desc: "Room readiness tracking, task assignment, laundry and maintenance request management.",         tags: ["Room Status", "Tasks", "Laundry", "Maintenance"] },
  { href: "/hospitality/inventory",      img: "/icon-inventory.png",    name: "Inventory",              desc: "Stock control, procurement, purchase orders and full supplier relationship management.",         tags: ["Stock", "Procurement", "POs", "Suppliers"] },
  { href: "/hospitality/events",         img: "/icon-events.png",       name: "Events & Banqueting",    desc: "Conference rooms, weddings, events management, function sheets and group billing.",             tags: ["Conferences", "Weddings", "Groups", "Function Sheets"] },
  { href: "/hospitality/multi-property", img: "/icon-hospitality.png",  name: "Multi-Property",         desc: "Centralised management across hotel groups, chains and multi-site portfolios.",                 tags: ["Groups", "Chains", "Central Reservations"] },
] as const;

const STATS = [
  { value: "500+", label: "Rooms Managed" },
  { value: "98%",  label: "Uptime SLA" },
  { value: "10K+", label: "Transactions Daily" },
  { value: "20+",  label: "Integrations" },
] as const;

const AUDIENCES = [
  { img: "/icon-hospitality.png", label: "Hotels" },
  { img: "/icon-hospitality.png", label: "Resorts" },
  { img: "/icon-hospitality.png", label: "Lodges" },
  { img: "/icon-hospitality.png", label: "Guest Houses" },
  { img: "/icon-hospitality.png", label: "Serviced Apartments" },
  { img: "/icon-hospitality.png", label: "Hostels" },
  { img: "/icon-access.png",      label: "Short-Let Operators" },
  { img: "/icon-systems.png",     label: "Property Managers" },
] as const;

export default function HospitalityPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO V2 ── */}
      <section
        className="div-hero-v2"
        style={{ "--div-color": "#00d4e8", "--div-color-dim": "rgba(0,212,232,.07)" } as React.CSSProperties}
      >
        <div className="div-hero-v2-glow" />
        <div className="contain">
          <div className="div-hero-v2-grid">
            {/* Left copy */}
            <div>
              <div className="div-hero-v2-badge">⬡ LodgeCore Hospitality</div>
              <h1 className="div-hero-v2-h1">
                The Operating System<br />for <em>Modern Hotels.</em>
              </h1>
              <p className="div-hero-v2-desc">
                A complete, connected hospitality technology platform. From reservations and front desk to food &amp; beverage, housekeeping, finance and multi-property management — all in one system.
              </p>
              <div className="div-hero-v2-ctas">
                <Link href="/book-demo" className="btn btn-primary btn-lg">Book a demo →</Link>
                <Link href="/hospitality/pms" className="btn btn-outline btn-lg">Explore PMS</Link>
                <Link href="/pricing" className="btn btn-outline btn-lg">View pricing</Link>
              </div>
              <div className="div-hero-v2-chips">
                {["Cloud-based", "Multi-property", "API-first", "No per-user fees", "African hosting option"].map(c => (
                  <span key={c} className="div-hero-chip">{c}</span>
                ))}
              </div>
            </div>
            {/* Right image */}
            <div className="div-hero-v2-img">
              <Image src="/hospitality-dashboard.png" alt="LodgeCore Hospitality Dashboard" width={720} height={540} priority />
            </div>
          </div>

          {/* Stats bar */}
          <div className="div-stats-bar">
            {STATS.map(s => (
              <div key={s.label} className="div-stat">
                <div className="div-stat-value">{s.value}</div>
                <div className="div-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULES GRID ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 56, maxWidth: 600 }}>
            <div className="section-kicker">Complete Platform</div>
            <h2 className="section-title">Every Module Your Property Needs.</h2>
            <p className="section-body">Built for real hospitality operations — not a one-size-fits-all SaaS. Each module is deeply integrated and works seamlessly with every other part of LodgeCore.</p>
          </div>
          <div className="cap-grid" style={{ "--div-color": "#00d4e8", "--div-color-dim": "rgba(0,212,232,.08)" } as React.CSSProperties}>
            {MODULES.map(m => (
              <Link key={m.href} href={m.href} className="cap-card" style={{ textDecoration: "none" }}>
                <div className="cap-icon">
                  <Image src={m.img} alt={m.name} width={56} height={56} style={{ borderRadius: 10, objectFit: "cover" }} />
                </div>
                <div className="cap-name">{m.name}</div>
                <div className="cap-desc">{m.desc}</div>
                <div className="cap-tags">
                  {m.tags.map(t => <span key={t} className="cap-tag">{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHBOARD FEATURE ROW ── */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div
            className="eco-panel"
            style={{ "--div-color": "#00d4e8", "--div-color-dim": "rgba(0,212,232,.08)" } as React.CSSProperties}
          >
            <div>
              <div className="section-kicker">Live Dashboard</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>Your Entire Hotel, One Screen.</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 24 }}>
                The LodgeCore dashboard gives you a live view of occupancy, revenue, check-in queues, housekeeping status, F&amp;B revenue and outstanding folios — in real time, from any device.
              </p>
              <div className="feature-list">
                {[
                  "Live reservation calendar with colour-coded room status",
                  "RevPAR, ADR and occupancy metrics updated in real time",
                  "Check-in queue with ETA tracking",
                  "F&B revenue breakdown by outlet",
                  "Night audit with one-click processing",
                ].map(f => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
                <Link href="/book-demo" className="btn btn-primary">See live demo →</Link>
                <Link href="/hospitality/pms" className="btn btn-outline">Explore PMS</Link>
              </div>
            </div>
            <div className="eco-img">
              <Image src="/hospitality-dashboard.png" alt="PMS Dashboard" width={600} height={450} />
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-kicker">Designed For</div>
            <h2 className="section-title">Built for Every Hospitality Business.</h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {AUDIENCES.map(a => (
              <div key={a.label} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "14px 22px",
                border: "1px solid var(--border-card)", borderRadius: "var(--radius-lg)",
                background: "var(--bg-card)", fontSize: 13, color: "var(--text-secondary)", fontWeight: 600,
                transition: "border-color .2s",
              }}>
                <Image src={a.img} alt={a.label} width={28} height={28} style={{ borderRadius: 6, objectFit: "cover" }} /> {a.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POS FEATURE ROW ── */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div className="feature-row flip" style={{ "--div-color": "#00d4e8" } as React.CSSProperties}>
            <div className="feature-row-visual">
              <div style={{ textAlign: "center" }}>
                  <Image src="/icon-pos.png" alt="POS System" width={100} height={100} style={{ borderRadius: 16, objectFit: "cover" }} />
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: ".15em", marginTop: 12, textTransform: "uppercase" }}>POS → PMS → Folio</div>
              </div>
            </div>
            <div className="feature-row-copy">
              <div className="feature-row-kicker">Point of Sale</div>
              <h2 className="feature-row-title">F&B, Room Service &amp; Retail — All Connected.</h2>
              <div className="feature-row-body">
                LodgeCore POS connects restaurant, bar, spa and retail directly to the PMS. Every charge posts instantly to the guest folio. No manual reconciliation, no end-of-day surprises.
              </div>
              <div className="feature-list">
                {["Direct folio posting from any outlet", "Table management and kitchen display system", "Split bills, covers and service charges", "Inventory deduction on every sale"].map(f => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/hospitality/pos" className="btn btn-primary">Explore POS →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">LodgeCore Hospitality</div>
          <h2 className="cta-title">See It Running in Your Property.</h2>
          <p className="cta-body">Book a personalised demo and we&apos;ll show you how LodgeCore Hospitality fits your property type and size — live, not slides.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Book a demo →</Link>
            <Link href="/pricing" className="btn btn-outline btn-lg">View pricing</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

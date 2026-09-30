import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Hospitality — Hotel Management Software Platform",
  description: "Complete hospitality software for hotels, resorts and serviced apartments. PMS, POS, booking engine, accounting, housekeeping, events and multi-property management.",
};

const MODULES = [
  { href: "/hospitality/pms",           icon: "🏨", name: "Property Management",  desc: "Front desk, reservations, room management, guest folios and check-in/out." },
  { href: "/hospitality/pos",           icon: "🍽", name: "Point of Sale",        desc: "Restaurant, bar, spa and room-service POS with automatic folio posting." },
  { href: "/hospitality/booking",       icon: "📅", name: "Booking Engine",       desc: "Direct online booking with rate management and OTA channel sync." },
  { href: "/hospitality/accounting",    icon: "📊", name: "Finance & Accounting", desc: "Folios, invoicing, cash management, night audit and full financial reporting." },
  { href: "/hospitality/housekeeping",  icon: "🧹", name: "Housekeeping",         desc: "Room readiness tracking, task assignment, laundry and maintenance requests." },
  { href: "/hospitality/inventory",     icon: "📦", name: "Inventory",            desc: "Stock control, procurement, purchase orders and supplier management." },
  { href: "/hospitality/events",        icon: "🎪", name: "Events & Banqueting",  desc: "Conference rooms, weddings, events, function sheets and group billing." },
  { href: "/hospitality/multi-property",icon: "🌐", name: "Multi-Property",       desc: "Centralised management for hotel groups, chains and portfolios." },
] as const;

const AUDIENCES = [
  { icon: "🏨", label: "Hotels" },
  { icon: "🌴", label: "Resorts" },
  { icon: "🏕", label: "Lodges" },
  { icon: "🏠", label: "Guest Houses" },
  { icon: "🏢", label: "Serviced Apartments" },
  { icon: "🎒", label: "Hostels" },
  { icon: "🏡", label: "Short-Let Operators" },
  { icon: "🏗", label: "Property Managers" },
] as const;

export default function HospitalityPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* Hero */}
      <section className="division-hero" style={{ "--div-color": "#00d4e8", "--div-color-dim": "rgba(0,212,232,.07)" } as React.CSSProperties}>
        <div className="division-hero-bg" />
        <div className="contain">
          <div className="division-hero-kicker">⬡ LodgeCore Hospitality</div>
          <h1 className="division-hero h1">
            The Operating System<br />for <em>Modern Hotels.</em>
          </h1>
          <p>
            A complete, connected hospitality technology platform. From reservations and front desk to food & beverage, housekeeping, finance and multi-property management — all in one system.
          </p>
          <div className="division-hero-ctas">
            <Link href="/book-demo" className="btn btn-primary">Book a demo →</Link>
            <Link href="/hospitality/pms" className="btn btn-outline">Explore PMS</Link>
            <Link href="/pricing" className="btn btn-outline">View pricing</Link>
          </div>
        </div>
      </section>

      {/* Modules grid */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48 }}>
            <div className="section-kicker">Complete Platform</div>
            <h2 className="section-title">Every Module Your Property Needs.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {MODULES.map((m) => (
              <Link key={m.href} href={m.href} className="portal-area-card">
                <div className="portal-area-icon">{m.icon}</div>
                <div className="portal-area-name">{m.name}</div>
                <div className="portal-area-desc">{m.desc}</div>
                <div className="portal-area-arrow">Learn more →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div style={{ marginBottom: 40, textAlign: "center" }}>
            <div className="section-kicker">Designed For</div>
            <h2 className="section-title">Built for Every Hospitality Business.</h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {AUDIENCES.map((a) => (
              <div key={a.label} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
                border: "1px solid var(--border-card)", borderRadius: "var(--radius-lg)",
                background: "var(--bg-card)", fontSize: 13, color: "var(--text-secondary)", fontWeight: 600,
              }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span> {a.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="section-gap">
        <div className="contain" style={{ display: "flex", flexDirection: "column", gap: 80 }}>
          <div className="feature-row" style={{ "--div-color": "#00d4e8" } as React.CSSProperties}>
            <div className="feature-row-visual">🏨</div>
            <div className="feature-row-copy">
              <div className="feature-row-kicker">Property Management</div>
              <h2 className="feature-row-title">Run Every Room, Every Guest, Every Stay.</h2>
              <div className="feature-row-body">
                LodgeCore PMS handles the full reservation lifecycle — from booking to checkout — including room management, guest profiles, group bookings, corporate accounts and multi-rate configuration.
              </div>
              <div className="feature-list">
                {["Real-time room availability and status", "Guest profile and history management", "Automated night audit and daily reports", "Integration with access control and smart rooms"].map((f) => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/hospitality/pms" className="btn btn-primary">Explore PMS →</Link>
            </div>
          </div>

          <div className="feature-row flip" style={{ "--div-color": "#00d4e8" } as React.CSSProperties}>
            <div className="feature-row-visual">🍽</div>
            <div className="feature-row-copy">
              <div className="feature-row-kicker">Point of Sale</div>
              <h2 className="feature-row-title">F&B, Room Service & Retail — All Connected.</h2>
              <div className="feature-row-body">
                LodgeCore POS connects restaurant, bar, spa and retail operations directly to the PMS. Every charge posts instantly to the guest folio. No manual reconciliation required.
              </div>
              <div className="feature-list">
                {["Direct folio posting from any outlet", "Table management and kitchen display", "Split bills, covers and service charges", "Inventory deduction on every sale"].map((f) => (
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

      {/* CTA */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">LodgeCore Hospitality</div>
          <h2 className="cta-title">See It Running in Your Property.</h2>
          <p className="cta-body">Book a personalised demo and we&apos;ll show you how LodgeCore Hospitality fits your property type and size.</p>
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

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Smart — Smart Rooms, Homes & Building Automation",
  description: "Smart hotel rooms, smart homes and building automation technology. Energy management, occupancy sensors, smart AC, lighting and IoT. Supplied and installed by LodgeCore.",
};

const CATEGORIES = [
  { href: "/smart/smart-hotel",       icon: "🏨", name: "Smart Hotel Rooms",   desc: "Energy management, key-card switches, occupancy sensors, smart AC, lighting and DND panels for guestrooms.",   tags: ["Energy", "Occupancy", "Smart AC", "Lighting"] },
  { href: "/smart/smart-home",        icon: "🏠", name: "Smart Homes",         desc: "Locks, lighting, switches, sockets, motorised curtains, AC control and full home automation.",               tags: ["Locks", "Lighting", "AC", "Curtains"] },
  { href: "/smart/smart-building",    icon: "🏗",  name: "Smart Buildings",     desc: "Building automation, energy management, occupancy monitoring and centralised access for commercial buildings.", tags: ["BMS", "Energy", "Occupancy"] },
  { href: "/smart/energy-management", icon: "⚡", name: "Energy Management",   desc: "Monitor, control and optimise energy use with smart meters, IoT sensors and rules-based automation.",         tags: ["Monitoring", "Control", "Optimisation"] },
  { href: "/smart/automation",        icon: "🤖", name: "Automation",          desc: "Scenes, schedules, occupancy triggers and multi-step automation sequences for any property.",                   tags: ["Scenes", "Schedules", "Rules"] },
] as const;

const STATS = [
  { value: "30%",  label: "Average Energy Saving" },
  { value: "100%", label: "PMS Integrated" },
  { value: "24/7", label: "Remote Monitoring" },
  { value: "5",    label: "Smart Categories" },
] as const;

const WHY = [
  { icon: "⚡", title: "Energy Savings",       desc: "Occupancy-based automation reduces energy waste in unoccupied rooms by up to 30%." },
  { icon: "🎯", title: "Guest Comfort",         desc: "Automatic climate, lighting and curtain control create premium, personalised room experiences." },
  { icon: "📊", title: "Real-Time Visibility",  desc: "See every room's occupancy, energy use and system status from one central dashboard." },
  { icon: "🔗", title: "PMS Integration",       desc: "Rooms activate automatically at check-in and power down at checkout — no manual intervention." },
  { icon: "🛡️", title: "Remote Management",    desc: "LodgeCore Care monitors all smart systems remotely with alerts and automated incident response." },
  { icon: "📈", title: "ROI in 12–18 Months",  desc: "Energy savings and operational efficiencies typically recover the investment within 18 months." },
] as const;

export default function SmartPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO V2 ── */}
      <section
        className="div-hero-v2"
        style={{ "--div-color": "#a78bfa", "--div-color-dim": "rgba(167,139,250,.06)" } as React.CSSProperties}
      >
        <div className="div-hero-v2-glow" />
        <div className="contain">
          <div className="div-hero-v2-grid">
            <div>
              <div className="div-hero-v2-badge">⚡ LodgeCore Smart</div>
              <h1 className="div-hero-v2-h1">
                Automate Rooms,<br /><em>Homes</em> and Buildings.
              </h1>
              <p className="div-hero-v2-desc">
                LodgeCore Smart connects energy, access, climate, lighting and IoT across hotels, homes and commercial buildings — in one managed, intelligent property ecosystem.
              </p>
              <div className="div-hero-v2-ctas">
                <Link href="/book-demo" className="btn btn-primary btn-lg">Talk to an expert →</Link>
                <Link href="/smart/smart-hotel" className="btn btn-outline btn-lg">Smart hotel rooms</Link>
              </div>
              <div className="div-hero-v2-chips">
                {["Energy Management", "Occupancy Sensors", "Smart AC", "PMS Integrated", "IoT"].map(c => (
                  <span key={c} className="div-hero-chip">{c}</span>
                ))}
              </div>
            </div>
            <div className="div-hero-v2-img">
              <Image src="/smart-dashboard.png" alt="LodgeCore Smart Room Dashboard" width={720} height={540} priority />
            </div>
          </div>
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

      {/* ── CATEGORIES ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 56, maxWidth: 600 }}>
            <div className="section-kicker">Smart Technology</div>
            <h2 className="section-title">Connected Technology for Every Property.</h2>
            <p className="section-body">From smart hotel guestrooms to fully automated commercial buildings — LodgeCore Smart covers the entire intelligence layer of your property.</p>
          </div>
          <div className="cap-grid" style={{ "--div-color": "#a78bfa", "--div-color-dim": "rgba(167,139,250,.08)" } as React.CSSProperties}>
            {CATEGORIES.map(c => (
              <Link key={c.href} href={c.href} className="cap-card" style={{ textDecoration: "none" }}>
                <div className="cap-icon">{c.icon}</div>
                <div className="cap-name">{c.name}</div>
                <div className="cap-desc">{c.desc}</div>
                <div className="cap-tags">
                  {c.tags.map(t => <span key={t} className="cap-tag">{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY SMART MATTERS ── */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div style={{ marginBottom: 56, maxWidth: 600 }}>
            <div className="section-kicker">Why Smart Matters</div>
            <h2 className="section-title">Intelligence That Pays for Itself.</h2>
          </div>
          <div className="cap-grid" style={{ "--div-color": "#a78bfa", "--div-color-dim": "rgba(167,139,250,.08)" } as React.CSSProperties}>
            {WHY.map(w => (
              <div key={w.title} className="cap-card">
                <div className="cap-icon">{w.icon}</div>
                <div className="cap-name">{w.title}</div>
                <div className="cap-desc">{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SMART HOTEL FEATURE ── */}
      <section className="section-gap">
        <div className="contain">
          <div className="eco-panel" style={{ "--div-color": "#a78bfa", "--div-color-dim": "rgba(167,139,250,.06)" } as React.CSSProperties}>
            <div>
              <div className="section-kicker">Smart Hotel Rooms</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>Rooms That Know When You&apos;re There.</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 24 }}>
                LodgeCore Smart hotel room technology activates on check-in, manages climate and lighting automatically based on occupancy, and powers down entirely at checkout — reducing energy waste to near zero.
              </p>
              <div className="feature-list">
                {[
                  "Key-card energy switch at room entry",
                  "Occupancy and motion sensor integration",
                  "Automatic thermostat and AC management",
                  "Lighting scene automation (arrive, sleep, away)",
                  "DND and Make Up Room panel with PMS sync",
                  "Energy consumption monitoring per room",
                ].map(f => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/smart/smart-hotel" className="btn btn-primary" style={{ marginTop: 16 }}>Explore Smart Hotel Rooms →</Link>
            </div>
            <div className="eco-img">
              <Image src="/smart-dashboard.png" alt="Smart Hotel Room Control" width={580} height={440} />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">LodgeCore Smart</div>
          <h2 className="cta-title">Make Your Property Smarter.</h2>
          <p className="cta-body">Talk to the LodgeCore Smart team about automation, energy management and connected property technology for your building.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Talk to an expert →</Link>
            <Link href="/solutions" className="btn btn-outline btn-lg">View solutions</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

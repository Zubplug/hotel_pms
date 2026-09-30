import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Smart — Smart Rooms, Homes & Building Automation",
  description: "Smart hotel rooms, smart homes and building automation. Energy management, occupancy sensors, smart AC and lighting. Supplied and installed by LodgeCore.",
};

const CATEGORIES = [
  { href: "/smart/smart-hotel",       icon: "🏨", name: "Smart Hotel Rooms",   desc: "Energy switches, occupancy sensors, smart AC, lighting and DND panels for hotel guestrooms.",              tags: ["Energy", "Occupancy", "AC", "Lighting"] },
  { href: "/smart/smart-home",        icon: "🏠", name: "Smart Homes",         desc: "Locks, lighting, smart sockets, curtains, AC control and home automation for residential properties.",      tags: ["Locks", "Lighting", "AC", "Curtains"] },
  { href: "/smart/smart-building",    icon: "🏗", name: "Smart Buildings",     desc: "Building automation, energy management, occupancy monitoring and centralised access for commercial buildings.", tags: ["BMS", "Energy", "Occupancy"] },
  { href: "/smart/energy-management", icon: "⚡", name: "Energy Management",   desc: "Monitor, control and optimise energy consumption with smart meters, sensors and automation.",               tags: ["Monitoring", "Control", "Optimisation"] },
  { href: "/smart/automation",        icon: "🤖", name: "Automation",          desc: "Scenes, schedules, rules-based triggers and multi-step automation for any property type.",                   tags: ["Scenes", "Schedules", "Rules"] },
] as const;

export default function SmartPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      <section className="division-hero" style={{ "--div-color": "#a78bfa", "--div-color-dim": "rgba(167,139,250,.06)" } as React.CSSProperties}>
        <div className="division-hero-bg" />
        <div className="contain">
          <div className="division-hero-kicker">⚡ LodgeCore Smart</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.6rem,5vw,4.2rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24 }}>
            Automate Rooms,<br /><span style={{ color: "#a78bfa" }}>Homes</span> and Buildings.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 560, marginBottom: 36 }}>
            LodgeCore Smart provides smart hotel room technology, residential home automation and building intelligence — connecting energy, access, climate, lighting and IoT in one managed system.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link href="/book-demo" className="btn btn-primary">Talk to an expert →</Link>
            <Link href="/smart/smart-hotel" className="btn btn-outline">Smart hotel rooms</Link>
            <Link href="/smart/smart-home" className="btn btn-outline">Smart homes</Link>
          </div>
        </div>
      </section>

      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48 }}>
            <div className="section-kicker">Smart Technology</div>
            <h2 className="section-title">Connected Technology for Every Property.</h2>
          </div>
          <div className="solutions-grid">
            {CATEGORIES.map((c) => (
              <Link key={c.href} href={c.href} className="solution-card">
                <div className="solution-icon">{c.icon}</div>
                <div className="solution-name">{c.name}</div>
                <div className="solution-desc">{c.desc}</div>
                <div className="solution-tech">{c.tags.map((t) => <span key={t} className="solution-tag">{t}</span>)}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div className="feature-row" style={{ "--div-color": "#a78bfa" } as React.CSSProperties}>
            <div className="feature-row-visual">⚡</div>
            <div className="feature-row-copy">
              <div className="feature-row-kicker">Why Smart Matters</div>
              <h2 className="feature-row-title">Intelligence That Pays for Itself.</h2>
              <div className="feature-row-body">
                Smart property technology reduces energy consumption, improves guest and resident experience, and gives operators real-time visibility into every room, space and system.
              </div>
              <div className="feature-list">
                {[
                  "Reduce energy costs through intelligent automation",
                  "Improve guest comfort with automatic climate control",
                  "Monitor every room&apos;s status in real time",
                  "Integrate with PMS for automatic room activation on check-in",
                ].map((f) => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span dangerouslySetInnerHTML={{ __html: f }} />
                  </div>
                ))}
              </div>
              <Link href="/book-demo" className="btn btn-primary">Request a consultation →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Make Your Property Smarter.</h2>
          <p className="cta-body">Talk to the LodgeCore Smart team about automation, energy management and connected property technology.</p>
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

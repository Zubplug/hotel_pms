import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Care — Maintenance, Support & Remote Monitoring",
  description: "Managed support, preventive maintenance, remote monitoring and technical assistance for all LodgeCore software and integrated hardware systems.",
};

const OFFERINGS = [
  { href: "/services/maintenance", icon: "🔧", name: "Preventive Maintenance",   desc: "Scheduled maintenance visits, system health checks and hardware servicing for all installed systems." },
  { href: "/services/support",     icon: "📞", name: "Technical Support",        desc: "Remote and on-site technical support from the LodgeCore team whenever you need it." },
  { href: "/care",                 icon: "📡", name: "Remote Monitoring",        desc: "24/7 remote monitoring of connected systems with alert escalation and incident management." },
  { href: "/care",                 icon: "⚡", name: "Emergency Callout",        desc: "Priority emergency response for critical system failures. SLA-backed response times." },
  { href: "/care",                 icon: "🔄", name: "Software Updates",         desc: "Managed LodgeCore software updates, patches and version upgrades with zero-downtime deployment." },
  { href: "/care",                 icon: "📖", name: "Training & Enablement",    desc: "Staff training, refresher sessions and documentation for all LodgeCore software and hardware." },
] as const;

const PLANS = [
  { name: "Essential", badge: "Software", features: ["Business hours support", "Remote assistance", "Software updates", "Online knowledge base"] },
  { name: "Professional", badge: "Software + Hardware", features: ["Extended hours support", "On-site visits included", "Remote monitoring", "Preventive maintenance", "Priority response"] },
  { name: "Enterprise", badge: "Custom", features: ["24/7 dedicated support", "Named account manager", "SLA guarantees", "Emergency callout", "On-site presence", "Custom reporting"] },
] as const;

export default function CarePage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      <section className="division-hero" style={{ "--div-color": "#ff8c60", "--div-color-dim": "rgba(255,140,96,.06)" } as React.CSSProperties}>
        <div className="division-hero-bg" />
        <div className="contain">
          <div className="division-hero-kicker">🛡️ LodgeCore Care</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.6rem,5vw,4.2rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24 }}>
            Support After<br /><span style={{ color: "#ff8c60" }}>the Technology</span><br />is Live.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 560, marginBottom: 36 }}>
            LodgeCore Care ensures your property technology stays operational, secure and optimised after deployment. Maintenance, monitoring, support and updates managed by the LodgeCore team.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link href="/book-demo" className="btn btn-primary">Talk to the Care team →</Link>
            <Link href="/services/support" className="btn btn-outline">Support services</Link>
          </div>
        </div>
      </section>

      {/* Offerings */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48 }}>
            <div className="section-kicker">What LodgeCore Care Covers</div>
            <h2 className="section-title">Every Aspect of Post-Deployment Support.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {OFFERINGS.map((o) => (
              <div key={o.name} className="portal-card">
                <div style={{ fontSize: 28, marginBottom: 14 }}>{o.icon}</div>
                <div className="portal-card-title" style={{ marginBottom: 8 }}>{o.name}</div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Care plans */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div style={{ marginBottom: 48, textAlign: "center" }}>
            <div className="section-kicker">Service Plans</div>
            <h2 className="section-title">Choose Your LodgeCore Care Level.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {PLANS.map((plan, i) => (
              <div key={plan.name} className="portal-card" style={{ border: i === 1 ? "1px solid var(--border-strong)" : undefined }}>
                {i === 1 && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "var(--accent)", letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 8 }}>
                    Most popular
                  </div>
                )}
                <div className="portal-card-title" style={{ marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 20 }}>{plan.badge}</div>
                <div className="feature-list" style={{ marginBottom: 24 }}>
                  {plan.features.map((f) => (
                    <div key={f} className="feature-list-item" style={{ fontSize: 12 }}>
                      <div className="feature-list-check">✓</div><span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/book-demo" className="btn btn-outline btn-sm" style={{ textAlign: "center", display: "block" }}>
                  Get a quote →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Keep Your Technology Running.</h2>
          <p className="cta-body">Talk to the LodgeCore Care team about a support plan tailored to your property.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Get a quote →</Link>
            <Link href="/services" className="btn btn-outline btn-lg">All services</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

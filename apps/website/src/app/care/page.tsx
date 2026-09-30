import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Care — Maintenance, Support & Remote Monitoring",
  description: "Managed support, preventive maintenance, remote monitoring and technical assistance for all LodgeCore software and integrated hardware systems.",
};

const STATS = [
  { value: "99.98%", label: "Uptime SLA" },
  { value: "24/7",   label: "Remote Monitoring" },
  { value: "<4h",    label: "Emergency Response" },
  { value: "3",      label: "Care Plans" },
] as const;

const OFFERINGS = [
  { img: "/icon-systems.png",  name: "Preventive Maintenance",  desc: "Scheduled maintenance visits, system health checks and hardware servicing for all installed systems on a regular cadence." },
  { img: "/icon-care.png",    name: "Technical Support",        desc: "Remote and on-site technical support from the LodgeCore team. Phone, email and ticket-based support across all plans." },
  { img: "/icon-care.png",    name: "Remote Monitoring",        desc: "24/7 remote monitoring of all connected systems with automated alert escalation and real-time incident management." },
  { img: "/icon-energy.png",  name: "Emergency Callout",        desc: "Priority emergency response for critical system failures. SLA-backed response times with on-site dispatch where required." },
  { img: "/icon-pms.png",     name: "Software Updates",         desc: "Managed LodgeCore software updates, security patches and version upgrades with zero-downtime deployment windows." },
  { img: "/icon-booking.png", name: "Training & Enablement",    desc: "Staff training sessions, refresher programmes and documentation for all LodgeCore software and hardware systems." },
] as const;

const PLANS = [
  {
    name: "Essential",
    badge: "Software",
    scope: "For software-only deployments",
    features: ["Business hours support (8am–6pm)", "Remote assistance via phone & ticket", "Software updates and patches", "Online knowledge base access", "Monthly system health report"],
  },
  {
    name: "Professional",
    badge: "Software + Hardware",
    scope: "For software and hardware deployments",
    featured: true,
    features: ["Extended hours support (8am–10pm)", "On-site visits included (quarterly)", "24/7 remote monitoring", "Preventive maintenance schedule", "Priority response SLA", "Hardware diagnostics and alerts"],
  },
  {
    name: "Enterprise",
    badge: "Custom",
    scope: "For large or multi-property deployments",
    features: ["24/7 dedicated support line", "Named account manager", "Custom SLA guarantees", "Emergency callout (on-site)", "Monthly on-site presence", "Custom reporting and dashboards"],
  },
] as const;

export default function CarePage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO V2 ── */}
      <section
        className="div-hero-v2"
        style={{ "--div-color": "#ff8c60", "--div-color-dim": "rgba(255,140,96,.06)" } as React.CSSProperties}
      >
        <div className="div-hero-v2-glow" />
        <div className="contain">
          <div className="div-hero-v2-grid">
            <div>
              <div className="div-hero-v2-badge">🛡️ LodgeCore Care</div>
              <h1 className="div-hero-v2-h1">
                Support After<br />the Technology<br />is <em>Live.</em>
              </h1>
              <p className="div-hero-v2-desc">
                LodgeCore Care ensures your property technology stays operational, secure and optimised after deployment — with managed monitoring, maintenance, support and updates.
              </p>
              <div className="div-hero-v2-ctas">
                <Link href="/book-demo" className="btn btn-primary btn-lg">Talk to the Care team →</Link>
                <Link href="/services/support" className="btn btn-outline btn-lg">Support services</Link>
              </div>
              <div className="div-hero-v2-chips">
                {["99.98% Uptime SLA", "24/7 Monitoring", "Emergency Callout", "Managed Updates"].map(c => (
                  <span key={c} className="div-hero-chip">{c}</span>
                ))}
              </div>
            </div>
            <div className="div-hero-v2-img">
              <Image src="/care-dashboard.png" alt="LodgeCore Care Monitoring Dashboard" width={720} height={540} priority />
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

      {/* ── OFFERINGS ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 56, maxWidth: 600 }}>
            <div className="section-kicker">What LodgeCore Care Covers</div>
            <h2 className="section-title">Every Aspect of Post-Deployment Support.</h2>
            <p className="section-body">From preventive maintenance visits to 24/7 remote monitoring — LodgeCore Care keeps your property technology running at peak performance.</p>
          </div>
          <div className="cap-grid" style={{ "--div-color": "#ff8c60", "--div-color-dim": "rgba(255,140,96,.08)" } as React.CSSProperties}>
            {OFFERINGS.map(o => (
              <div key={o.name} className="cap-card">
                <div className="cap-icon">
                  <Image src={o.img} alt={o.name} width={56} height={56} style={{ borderRadius: 10, objectFit: "cover" }} />
                </div>
                <div className="cap-name">{o.name}</div>
                <div className="cap-desc">{o.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MONITORING FEATURE ── */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div className="eco-panel" style={{ "--div-color": "#ff8c60", "--div-color-dim": "rgba(255,140,96,.06)" } as React.CSSProperties}>
            <div>
              <div className="section-kicker">Remote Monitoring</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>We Watch Your Systems So You Don&apos;t Have To.</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 24 }}>
                LodgeCore Care Professional and Enterprise plans include 24/7 remote monitoring of all connected systems — from door locks and smart room devices to the PMS server and network infrastructure.
              </p>
              <div className="feature-list">
                {[
                  "System health grid with real-time status indicators",
                  "Hardware diagnostics — battery levels, connectivity, firmware",
                  "SLA-backed support ticket management with countdown timers",
                  "99.98% uptime monitoring with zero-downtime deployment windows",
                  "Maintenance visit log and upcoming schedule tracker",
                  "Software version tracking across all systems",
                ].map(f => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/book-demo" className="btn btn-primary" style={{ marginTop: 16 }}>Get a Care quote →</Link>
            </div>
            <div className="eco-img">
              <Image src="/care-dashboard.png" alt="Care Monitoring Dashboard" width={580} height={440} />
            </div>
          </div>
        </div>
      </section>

      {/* ── CARE PLANS ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 56, textAlign: "center" }}>
            <div className="section-kicker">Service Plans</div>
            <h2 className="section-title">Choose Your LodgeCore Care Level.</h2>
          </div>
          <div className="care-plans" style={{ "--div-color": "#ff8c60" } as React.CSSProperties}>
            {PLANS.map((plan) => (
              <div key={plan.name} className={`care-plan${"featured" in plan && plan.featured ? " featured" : ""}`}>
                {"featured" in plan && plan.featured && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "var(--div-color, var(--accent))", letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 8 }}>★ Most popular</div>
                )}
                <div className="care-plan-badge">{plan.badge}</div>
                <div className="care-plan-name">{plan.name}</div>
                <div className="care-plan-scope">{plan.scope}</div>
                <div className="care-plan-divider" />
                <div className="feature-list" style={{ marginBottom: 24 }}>
                  {plan.features.map(f => (
                    <div key={f} className="feature-list-item" style={{ fontSize: 12 }}>
                      <div className="feature-list-check">✓</div><span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/book-demo" className="btn btn-outline btn-sm" style={{ textAlign: "center", display: "block" }}>Get a quote →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">LodgeCore Care</div>
          <h2 className="cta-title">Keep Your Technology Running.</h2>
          <p className="cta-body">Talk to the LodgeCore Care team about a support plan tailored to your property, technology stack and operational requirements.</p>
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

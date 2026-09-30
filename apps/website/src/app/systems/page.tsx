import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Systems — Property Technology Deployment & Integration",
  description: "End-to-end property technology deployment. Hardware supply, on-site installation, system integration and full project management by LodgeCore Systems.",
};

const STATS = [
  { value: "50+",  label: "Properties Deployed" },
  { value: "8",    label: "Deployment Steps" },
  { value: "100%", label: "On-Site Installation" },
  { value: "5★",   label: "Client Satisfaction" },
] as const;

const SERVICES = [
  { href: "/services/installation",  icon: "🔧", name: "Installation",      desc: "Professional on-site installation of all hardware — locks, access control, smart devices and structured cabling.",    tags: ["On-Site", "Certified", "All Hardware"] },
  { href: "/services/integration",   icon: "🔗", name: "Integration",       desc: "Connecting PMS, POS, access control, smart systems and third-party platforms through APIs and middleware.",          tags: ["API", "Middleware", "Multi-System"] },
  { href: "/services/deployment",    icon: "🚀", name: "Full Deployment",   desc: "End-to-end property technology rollout from consultation and specification through to handover and training.",        tags: ["End-to-End", "Managed", "Turnkey"] },
  { href: "/services/maintenance",   icon: "🛡️", name: "Maintenance",       desc: "Preventive maintenance schedules, emergency callout and hardware replacement services under LodgeCore Care.",         tags: ["Preventive", "Emergency", "SLA"] },
  { href: "/services/support",       icon: "📞", name: "Technical Support", desc: "Remote and on-site technical support from the LodgeCore team for all software and integrated hardware systems.",    tags: ["Remote", "On-Site", "Multi-System"] },
] as const;

const STEPS = [
  { n: "01", label: "Consult",    sub: "Understand your property&apos;s requirements, challenges, timeline and technology objectives." },
  { n: "02", label: "Specify",    sub: "Recommend the right hardware, software and integration architecture for your property." },
  { n: "03", label: "Supply",     sub: "Source and deliver all hardware from verified technology vendors, checked and logged." },
  { n: "04", label: "Install",    sub: "On-site installation of all hardware by trained and certified LodgeCore technicians." },
  { n: "05", label: "Configure",  sub: "Configure all systems, access levels, permissions, rates and software settings." },
  { n: "06", label: "Integrate",  sub: "Connect all systems — PMS, POS, access, smart and third-party platforms via APIs." },
  { n: "07", label: "Train",      sub: "Comprehensive staff training on all systems, daily operations and emergency procedures." },
  { n: "08", label: "Support",    sub: "Ongoing LodgeCore Care monitoring, maintenance and support post-deployment." },
] as const;

export default function SystemsPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO V2 ── */}
      <section
        className="div-hero-v2"
        style={{ "--div-color": "#ffbe5a", "--div-color-dim": "rgba(255,190,90,.06)" } as React.CSSProperties}
      >
        <div className="div-hero-v2-glow" />
        <div className="contain">
          <div className="div-hero-v2-grid">
            <div>
              <div className="div-hero-v2-badge">🔧 LodgeCore Systems</div>
              <h1 className="div-hero-v2-h1">
                We Don&apos;t Just Sell<br /><em>Technology.</em><br />We Deploy It.
              </h1>
              <p className="div-hero-v2-desc">
                LodgeCore Systems handles the complete deployment of property technology — from hardware supply and installation through to software configuration, system integration, staff training and ongoing support.
              </p>
              <div className="div-hero-v2-ctas">
                <Link href="/book-demo" className="btn btn-primary btn-lg">Talk to Systems team →</Link>
                <Link href="/services" className="btn btn-outline btn-lg">View all services</Link>
              </div>
              <div className="div-hero-v2-chips">
                {["End-to-End", "On-Site Installation", "API Integration", "Staff Training", "8-Step Process"].map(c => (
                  <span key={c} className="div-hero-chip">{c}</span>
                ))}
              </div>
            </div>
            <div className="div-hero-v2-img">
              <Image src="/systems-dashboard.png" alt="LodgeCore Systems Deployment Dashboard" width={720} height={540} priority />
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

      {/* ── DEPLOYMENT STEPS ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 56, maxWidth: 600 }}>
            <div className="section-kicker">The LodgeCore Way</div>
            <h2 className="section-title">End-to-End Property Technology Deployment.</h2>
            <p className="section-body">Every LodgeCore Systems engagement follows a structured 8-step methodology that ensures nothing is missed from consultation to ongoing support.</p>
          </div>
          <div
            className="process-grid"
            style={{ "--div-color": "#ffbe5a" } as React.CSSProperties}
          >
            {STEPS.map(step => (
              <div key={step.n} className="process-step">
                <div className="process-num">{step.n}</div>
                <div className="process-label">{step.label}</div>
                <div className="process-sub" dangerouslySetInnerHTML={{ __html: step.sub }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div style={{ marginBottom: 56 }}>
            <div className="section-kicker">What We Provide</div>
            <h2 className="section-title">Systems Services.</h2>
          </div>
          <div className="cap-grid" style={{ "--div-color": "#ffbe5a", "--div-color-dim": "rgba(255,190,90,.08)" } as React.CSSProperties}>
            {SERVICES.map(s => (
              <Link key={s.href} href={s.href} className="cap-card" style={{ textDecoration: "none" }}>
                <div className="cap-icon">{s.icon}</div>
                <div className="cap-name">{s.name}</div>
                <div className="cap-desc">{s.desc}</div>
                <div className="cap-tags">
                  {s.tags.map(t => <span key={t} className="cap-tag">{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── DASHBOARD FEATURE ── */}
      <section className="section-gap">
        <div className="contain">
          <div className="eco-panel" style={{ "--div-color": "#ffbe5a", "--div-color-dim": "rgba(255,190,90,.06)" } as React.CSSProperties}>
            <div>
              <div className="section-kicker">Deployment Visibility</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>Track Every Step of Your Deployment.</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 24 }}>
                During every LodgeCore Systems project, you have full visibility into deployment progress — hardware inventory, installation scheduling, integration status and sign-off milestones tracked in real time.
              </p>
              <div className="feature-list">
                {[
                  "8-step deployment timeline with milestone tracking",
                  "Hardware inventory checklist with delivery status",
                  "Integration map showing all connected systems",
                  "Technician scheduling and on-site visit calendar",
                  "Handover sign-off and go-live confirmation",
                ].map(f => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/book-demo" className="btn btn-primary" style={{ marginTop: 16 }}>Request a consultation →</Link>
            </div>
            <div className="eco-img">
              <Image src="/systems-dashboard.png" alt="Deployment Dashboard" width={580} height={440} />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">LodgeCore Systems</div>
          <h2 className="cta-title">Ready to Deploy Your Property Technology?</h2>
          <p className="cta-body">Tell us about your property and we&apos;ll design a deployment plan that fits your requirements and timeline.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Request a consultation →</Link>
            <Link href="/services" className="btn btn-outline btn-lg">All services</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

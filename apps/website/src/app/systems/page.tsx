import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Systems — Property Technology Deployment & Integration",
  description: "Hardware supply, on-site installation, system integration and full property technology deployment by LodgeCore Systems.",
};

const SERVICES = [
  { href: "/services/installation",  icon: "🔧", name: "Installation",      desc: "Professional on-site installation of all hardware including locks, access control, smart devices and networking." },
  { href: "/services/integration",   icon: "🔗", name: "Integration",       desc: "Connecting PMS, POS, access control, smart systems and third-party platforms through APIs and middleware." },
  { href: "/services/deployment",    icon: "🚀", name: "Full Deployment",   desc: "End-to-end property technology rollout from consultation and specification through to handover and training." },
  { href: "/services/maintenance",   icon: "🛡️", name: "Maintenance",       desc: "Preventive maintenance schedules, emergency callout and hardware replacement services." },
  { href: "/services/support",       icon: "📞", name: "Technical Support", desc: "Remote and on-site technical support for all LodgeCore software and integrated hardware systems." },
] as const;

const STEPS = [
  { n: "1", label: "Consult",    sub: "Understand your property's requirements, challenges and objectives." },
  { n: "2", label: "Specify",    sub: "Recommend the right hardware, software and integration approach." },
  { n: "3", label: "Supply",     sub: "Source and deliver all hardware from verified technology vendors." },
  { n: "4", label: "Install",    sub: "On-site installation of all hardware by trained LodgeCore technicians." },
  { n: "5", label: "Configure",  sub: "Configure all systems, access levels, permissions and software settings." },
  { n: "6", label: "Integrate",  sub: "Connect all systems — PMS, POS, access, smart and third-party platforms." },
  { n: "7", label: "Train",      sub: "Comprehensive staff training on all systems and daily operations." },
  { n: "8", label: "Support",    sub: "Ongoing LodgeCore Care support, monitoring and maintenance." },
] as const;

export default function SystemsPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* Hero */}
      <section className="division-hero" style={{ "--div-color": "#ffbe5a", "--div-color-dim": "rgba(255,190,90,.06)" } as React.CSSProperties}>
        <div className="division-hero-bg" />
        <div className="contain">
          <div className="division-hero-kicker">🔧 LodgeCore Systems</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.6rem,5vw,4.2rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24 }}>
            We Don&apos;t Just Sell<br /><span style={{ color: "#ffbe5a" }}>Technology.</span><br />We Deploy It.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 560, marginBottom: 36 }}>
            LodgeCore Systems handles the complete deployment of property technology — from hardware supply and installation through to software configuration, system integration, staff training and ongoing support.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link href="/book-demo" className="btn btn-primary">Talk to Systems team →</Link>
            <Link href="/services" className="btn btn-outline">View all services</Link>
          </div>
        </div>
      </section>

      {/* Deployment steps */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48, maxWidth: 600 }}>
            <div className="section-kicker">The LodgeCore Way</div>
            <h2 className="section-title">End-to-End Property Technology Deployment.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {STEPS.map((step, i) => (
              <div key={step.n} style={{
                display: "flex", gap: 28, alignItems: "flex-start", padding: "20px 24px",
                border: "1px solid var(--border-card)", background: "var(--bg-card)",
                borderRadius: i === 0 ? "var(--radius-lg) var(--radius-lg) 0 0" : i === STEPS.length - 1 ? "0 0 var(--radius-lg) var(--radius-lg)" : 0,
                borderTop: i > 0 ? "none" : undefined,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "rgba(255,190,90,.1)", border: "1px solid rgba(255,190,90,.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#ffbe5a", flexShrink: 0,
                }}>
                  {step.n}
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.02em", marginBottom: 4 }}>{step.label}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{step.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div style={{ marginBottom: 48 }}>
            <div className="section-kicker">What We Provide</div>
            <h2 className="section-title">Systems Services.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {SERVICES.map((s) => (
              <Link key={s.href} href={s.href} className="solution-card">
                <div className="solution-icon">{s.icon}</div>
                <div className="solution-name">{s.name}</div>
                <div className="solution-desc">{s.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
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

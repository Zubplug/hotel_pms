import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Services — Installation, Integration & Deployment | LodgeCore",
  description: "LodgeCore Systems provides on-site installation, system integration, full property technology deployment, preventive maintenance and technical support.",
};

const SERVICES = [
  { href: "/services/installation",  icon: "🔧", name: "Installation",       desc: "Professional on-site installation of all hardware — locks, access control, smart devices, cameras and networking." },
  { href: "/services/integration",   icon: "🔗", name: "Integration",        desc: "System and API integration connecting PMS, POS, access control, smart systems and third-party platforms." },
  { href: "/services/deployment",    icon: "🚀", name: "Full Deployment",    desc: "End-to-end property technology rollout from specification through to handover and staff training." },
  { href: "/services/maintenance",   icon: "🛡️", name: "Maintenance",        desc: "Preventive maintenance schedules, hardware servicing and emergency callout for all installed systems." },
  { href: "/services/support",       icon: "📞", name: "Technical Support",  desc: "Remote and on-site technical support from the LodgeCore Care team for software and hardware systems." },
] as const;

export default function ServicesPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      <section style={{ paddingTop: 140, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 50% at 30% 40%, rgba(255,190,90,.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div className="contain">
          <div className="section-kicker">LodgeCore Systems & Care</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem,5vw,4rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24, maxWidth: 680 }}>
            We Deliver, Install and<br />Support Your Technology.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 540, marginBottom: 36 }}>
            LodgeCore provides the full spectrum of property technology services — from installation and integration through to maintenance and ongoing technical support.
          </p>
          <Link href="/book-demo" className="btn btn-primary">Talk to the Systems team →</Link>
        </div>
      </section>

      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48 }}>
            <div className="section-kicker">What We Provide</div>
            <h2 className="section-title">The Full Service Spectrum.</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SERVICES.map((s, i) => (
              <Link key={s.href} href={s.href} className="service-row-card">
                <div className="service-row-num">0{i + 1}</div>
                <div className="service-row-icon">{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div className="service-row-name">{s.name}</div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 4 }}>{s.desc}</p>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", flexShrink: 0 }}>Explore →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Ready to Get Started?</h2>
          <p className="cta-body">Tell us about your property and we&apos;ll design a technology plan that fits your requirements, timeline and budget.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Request a consultation →</Link>
            <Link href="/systems" className="btn btn-outline btn-lg">LodgeCore Systems</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

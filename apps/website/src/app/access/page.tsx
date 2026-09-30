import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Access — Electronic Locks & Access Control for Properties",
  description: "Hotel electronic locks, RFID, smart locks, access control, card encoders and door hardware supplied, installed and maintained by LodgeCore.",
};

const PRODUCTS = [
  { href: "/access/hotel-locks",    icon: "🔒", name: "Hotel Electronic Locks", desc: "RFID, MIFARE and smart locks for hotel guestrooms and common areas.", tags: ["RFID", "MIFARE", "Mortise", "Handle Sets"] },
  { href: "/access/smart-locks",    icon: "📱", name: "Smart Locks",            desc: "PIN, Bluetooth, mobile key and biometric smart lock solutions.", tags: ["Bluetooth", "Mobile Key", "PIN", "Fingerprint"] },
  { href: "/access/access-control", icon: "🚪", name: "Access Control",         desc: "Controllers, RFID readers, electric strikes, magnetic locks and exit hardware.", tags: ["Controllers", "Readers", "Strikes", "Mag Locks"] },
  { href: "/access/encoders",       icon: "💾", name: "Card Encoders",          desc: "RFID and MIFARE key card encoding and management systems.", tags: ["Encoding", "RFID Cards", "MIFARE", "Programming"] },
  { href: "/access/programmers",    icon: "⚙️", name: "Lock Programmers",       desc: "Handheld and USB programmers for configuring and maintaining lock systems.", tags: ["Handheld", "USB", "Configuration"] },
  { href: "/access/door-hardware",  icon: "🔧", name: "Door Hardware",          desc: "Door handles, lock bodies, cylinders, closers and mechanical hardware.", tags: ["Handles", "Cylinders", "Closers", "Bodies"] },
] as const;

export default function AccessPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* Hero */}
      <section className="division-hero" style={{ "--div-color": "#3ef5a0", "--div-color-dim": "rgba(62,245,160,.06)" } as React.CSSProperties}>
        <div className="division-hero-bg" />
        <div className="contain">
          <div className="division-hero-kicker">🔑 LodgeCore Access</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.6rem,5vw,4.2rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24 }}>
            Control Every Door,<br /><span style={{ color: "#3ef5a0" }}>Every Room,</span><br />Every Property.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 560, marginBottom: 36 }}>
            LodgeCore Access provides electronic locks, RFID access control, smart lock technology and door hardware — supplied, installed, configured and maintained for hotels, apartments, offices and homes.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Link href="/book-demo" className="btn btn-primary">Request a quote →</Link>
            <Link href="/access/hotel-locks" className="btn btn-outline">Hotel locks</Link>
            <Link href="/hardware/locks" className="btn btn-outline">Browse hardware</Link>
          </div>
        </div>
      </section>

      {/* Important disclaimer */}
      <div className="contain" style={{ padding: "20px 28px" }}>
        <div style={{
          padding: "14px 20px", borderRadius: "var(--radius-md)",
          background: "rgba(255,190,90,.06)", border: "1px solid rgba(255,190,90,.2)",
          fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6,
        }}>
          <strong style={{ color: "var(--amber)" }}>Hardware supplied by LodgeCore.</strong> All access hardware listed is sourced, supplied and installed by LodgeCore. LodgeCore does not manufacture hardware but selects and works with leading access technology vendors.
        </div>
      </div>

      {/* Products */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48 }}>
            <div className="section-kicker">Access Products</div>
            <h2 className="section-title">Everything You Need for Property Access.</h2>
          </div>
          <div className="solutions-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {PRODUCTS.map((p) => (
              <Link key={p.href} href={p.href} className="solution-card">
                <div className="solution-icon">{p.icon}</div>
                <div className="solution-name">{p.name}</div>
                <div className="solution-desc">{p.desc}</div>
                <div className="solution-tech">
                  {p.tags.map((t) => <span key={t} className="solution-tag">{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PMS integration highlight */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div className="feature-row" style={{ "--div-color": "#3ef5a0" } as React.CSSProperties}>
            <div className="feature-row-visual">🔑</div>
            <div className="feature-row-copy">
              <div className="feature-row-kicker">Software + Hardware</div>
              <h2 className="feature-row-title">Locks That Talk to Your PMS.</h2>
              <div className="feature-row-body">
                When LodgeCore Hospitality and LodgeCore Access work together, key cards are issued automatically at check-in and revoked at checkout — no separate key system required.
              </div>
              <div className="feature-list">
                {[
                  "Automatic key issuance on check-in",
                  "Room access controlled by PMS reservation",
                  "Staff and master key management",
                  "Audit trail of all access events",
                  "Emergency override and master card support",
                ].map((f) => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/hospitality/pms" className="btn btn-outline">Learn about PMS integration →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-kicker">LodgeCore Systems</div>
            <h2 className="section-title">Supply, Install, Configure and Maintain.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {[
              { icon: "📋", title: "Specification", desc: "We help you select the right lock technology for your property type, door configuration and access requirements." },
              { icon: "📦", title: "Supply",        desc: "Hardware delivered to site from verified access technology vendors, checked and ready to install." },
              { icon: "🔧", title: "Installation",  desc: "Professional on-site installation of all lock hardware by trained LodgeCore technicians." },
              { icon: "🛡️", title: "Maintenance",   desc: "Preventive maintenance, emergency callout and lock replacement services under LodgeCore Care contracts." },
            ].map((step) => (
              <div key={step.title} className="portal-card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{step.icon}</div>
                <div className="portal-card-title" style={{ justifyContent: "center", marginBottom: 8 }}>{step.title}</div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Ready to Upgrade Your Property Access?</h2>
          <p className="cta-body">Talk to the LodgeCore Access team about electronic locks, access control and smart hardware for your property.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Request a quote →</Link>
            <Link href="/hardware/locks" className="btn btn-outline btn-lg">Browse hardware</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

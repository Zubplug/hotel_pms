import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "LodgeCore Access — Electronic Locks & Access Control for Properties",
  description: "Hotel electronic locks, RFID, smart locks, access control, card encoders and door hardware. Supplied, installed and maintained by LodgeCore.",
};

const PRODUCTS = [
  { href: "/access/hotel-locks",    img: "/icon-hotel-lock.png",  name: "Hotel Electronic Locks", desc: "RFID and MIFARE locks for hotel guestrooms and common areas. Integrated with PMS.",       tags: ["RFID", "MIFARE", "Mortise", "Handle Sets"] },
  { href: "/access/smart-locks",    img: "/icon-smart-lock.png",  name: "Smart Locks",            desc: "PIN, Bluetooth, mobile key and biometric locks for apartments, homes and offices.",       tags: ["Bluetooth", "Mobile Key", "PIN", "Fingerprint"] },
  { href: "/access/access-control", img: "/icon-access.png",      name: "Access Control",         desc: "Controllers, RFID readers, electric strikes, magnetic locks and exit hardware.",          tags: ["Controllers", "Readers", "Strikes", "Mag Locks"] },
  { href: "/access/encoders",       img: "/icon-pms.png",         name: "Card Encoders",          desc: "RFID and MIFARE key card encoding and management systems for hotel front desks.",          tags: ["Encoding", "RFID Cards", "MIFARE"] },
  { href: "/access/programmers",    img: "/icon-systems.png",     name: "Lock Programmers",       desc: "Handheld and USB programmers for configuring and maintaining electronic lock systems.",   tags: ["Handheld", "USB", "Configuration"] },
  { href: "/access/door-hardware",  img: "/icon-hardware.png",    name: "Door Hardware",          desc: "Door handles, lock bodies, cylinders, closers and mechanical hardware.",                  tags: ["Handles", "Cylinders", "Closers"] },
] as const;

const STATS = [
  { value: "500+", label: "Locks Installed" },
  { value: "50+",  label: "Properties Secured" },
  { value: "6",    label: "Product Categories" },
  { value: "24h",  label: "Emergency Response" },
] as const;

const STEPS = [
  { n: "01", label: "Specification",  sub: "Select the right lock technology for your property type, door configuration and access requirements." },
  { n: "02", label: "Supply",         sub: "Hardware delivered from verified technology vendors, checked and ready to install." },
  { n: "03", label: "Installation",   sub: "Professional on-site installation of all lock hardware by trained LodgeCore technicians." },
  { n: "04", label: "Integration",    sub: "Connect locks to PMS for automatic key issuance on check-in and revocation at checkout." },
  { n: "05", label: "Configuration",  sub: "Programme all access levels, staff hierarchies, master cards and audit settings." },
  { n: "06", label: "Training",       sub: "Train your front desk team on key encoding, key management and emergency procedures." },
  { n: "07", label: "Monitoring",     sub: "Remote access audit trail, battery monitoring and system health under LodgeCore Care." },
  { n: "08", label: "Maintenance",    sub: "Scheduled maintenance, battery replacement, firmware updates and emergency callout." },
] as const;

export default function AccessPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO V2 ── */}
      <section
        className="div-hero-v2"
        style={{ "--div-color": "#3ef5a0", "--div-color-dim": "rgba(62,245,160,.06)" } as React.CSSProperties}
      >
        <div className="div-hero-v2-glow" />
        <div className="contain">
          <div className="div-hero-v2-grid">
            <div>
              <div className="div-hero-v2-badge">🔑 LodgeCore Access</div>
              <h1 className="div-hero-v2-h1">
                Control Every Door,<br /><em>Every Room,</em><br />Every Property.
              </h1>
              <p className="div-hero-v2-desc">
                Electronic locks, RFID access control, smart lock technology and door hardware — sourced, supplied, installed, configured and maintained for hotels, apartments, offices and homes.
              </p>
              <div className="div-hero-v2-ctas">
                <Link href="/book-demo" className="btn btn-primary btn-lg">Request a quote →</Link>
                <Link href="/access/hotel-locks" className="btn btn-outline btn-lg">Hotel locks</Link>
              </div>
              <div className="div-hero-v2-chips">
                {["RFID", "MIFARE", "Bluetooth", "Mobile Key", "Biometric", "PMS Integrated"].map(c => (
                  <span key={c} className="div-hero-chip">{c}</span>
                ))}
              </div>
            </div>
            <div className="div-hero-v2-img">
              <Image src="/access-dashboard.png" alt="LodgeCore Access Control Dashboard" width={720} height={540} priority />
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

      {/* ── NOTICE ── */}
      <div className="contain" style={{ paddingBottom: 0 }}>
        <div className="notice-banner">
          <strong>Hardware supplied by LodgeCore.</strong> All access hardware is sourced from verified vendors and supplied, installed and maintained by LodgeCore. We do not manufacture hardware.
        </div>
      </div>

      {/* ── PRODUCTS GRID ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 56 }}>
            <div className="section-kicker">Access Products</div>
            <h2 className="section-title">Everything You Need for Property Access.</h2>
            <p className="section-body">From hotel guestroom locks to commercial access control systems — LodgeCore Access covers every door.</p>
          </div>
          <div className="cap-grid" style={{ "--div-color": "#3ef5a0", "--div-color-dim": "rgba(62,245,160,.08)" } as React.CSSProperties}>
            {PRODUCTS.map(p => (
              <Link key={p.href} href={p.href} className="cap-card" style={{ textDecoration: "none" }}>
                <div className="cap-icon">
                  <Image src={p.img} alt={p.name} width={56} height={56} style={{ borderRadius: 10, objectFit: "cover" }} />
                </div>
                <div className="cap-name">{p.name}</div>
                <div className="cap-desc">{p.desc}</div>
                <div className="cap-tags">
                  {p.tags.map(t => <span key={t} className="cap-tag">{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PMS INTEGRATION ── */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div className="eco-panel" style={{ "--div-color": "#3ef5a0", "--div-color-dim": "rgba(62,245,160,.06)" } as React.CSSProperties}>
            <div>
              <div className="section-kicker">Software + Hardware</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>Locks That Talk to Your PMS.</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 24 }}>
                When LodgeCore Hospitality and LodgeCore Access work together, key cards are encoded and issued automatically at check-in and revoked at checkout — zero manual intervention.
              </p>
              <div className="feature-list">
                {[
                  "Automatic key issuance on check-in confirmation",
                  "Room access controlled by active PMS reservation",
                  "Staff and master key hierarchy management",
                  "Full audit trail of every access event",
                  "Emergency override and master card support",
                  "Low battery alerts sent to maintenance",
                ].map(f => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/hospitality/pms" className="btn btn-outline" style={{ marginTop: 16 }}>Learn about PMS integration →</Link>
            </div>
            <div className="eco-img">
              <Image src="/access-dashboard.png" alt="Access Control Dashboard" width={580} height={440} />
            </div>
          </div>
        </div>
      </section>

      {/* ── DEPLOYMENT PROCESS ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48, maxWidth: 600 }}>
            <div className="section-kicker">The LodgeCore Way</div>
            <h2 className="section-title">Supply, Install, Configure and Maintain.</h2>
          </div>
          <div
            className="process-grid"
            style={{ "--div-color": "#3ef5a0" } as React.CSSProperties}
          >
            {STEPS.map(step => (
              <div key={step.n} className="process-step">
                <div className="process-num">{step.n}</div>
                <div className="process-label">{step.label}</div>
                <div className="process-sub">{step.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">LodgeCore Access</div>
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

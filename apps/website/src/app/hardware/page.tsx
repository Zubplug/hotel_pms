import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Hardware — Electronic Locks, Access Control & Smart Systems | LodgeCore",
  description: "Hardware supplied by LodgeCore — electronic locks, RFID access control, smart room systems, security cameras, networking and programming tools.",
};

const CATEGORIES = [
  {
    href: "/hardware/locks",
    icon: "🔒",
    name: "Electronic Locks",
    desc: "RFID, MIFARE, Bluetooth and smart lock solutions for hotels, apartments, offices and homes.",
    products: ["Hotel RFID Locks", "Smart PIN Locks", "Bluetooth Locks", "Fingerprint Locks", "Mortise & Handle Sets", "Rim Locks"],
  },
  {
    href: "/hardware/access-control",
    icon: "🚪",
    name: "Access Control",
    desc: "Controllers, card readers, electric strikes, magnetic locks and door control hardware.",
    products: ["Access Controllers", "RFID Readers", "Electric Strikes", "Magnetic Locks", "Exit Hardware", "Door Sensors"],
  },
  {
    href: "/hardware/smart-room",
    icon: "⚡",
    name: "Smart Room Systems",
    desc: "Key-card switches, occupancy sensors, smart thermostats and room control panels for hotels and residences.",
    products: ["Key-Card Switches", "Occupancy Sensors", "Smart Thermostats", "Room Panels", "Curtain Controllers", "Smart Sockets"],
  },
  {
    href: "/hardware/security",
    icon: "📷",
    name: "Security",
    desc: "IP cameras, NVR systems, intercom and perimeter security hardware.",
    products: ["IP Cameras", "NVR Systems", "Intercom Systems", "Video Doorbells", "Gate Controllers"],
  },
  {
    href: "/hardware/networking",
    icon: "🌐",
    name: "Networking",
    desc: "Routers, switches, access points and structured cabling for property networks.",
    products: ["Business Routers", "Managed Switches", "Wi-Fi Access Points", "PoE Switches", "Cabling Systems"],
  },
  {
    href: "/hardware/programming",
    icon: "💾",
    name: "Programming Tools",
    desc: "Card encoders, lock programmers and configuration tools for managing access hardware.",
    products: ["Card Encoders", "Handheld Programmers", "USB Programmers", "Blank Key Cards", "Programming Software"],
  },
] as const;

export default function HardwarePage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* Hero */}
      <section style={{ paddingTop: 140, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,190,90,.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div className="contain">
          <div className="section-kicker">LodgeCore Hardware</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem,5vw,4rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24, maxWidth: 700 }}>
            The Hardware Behind<br />Smarter Properties.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 540, marginBottom: 36 }}>
            Electronic locks, access control, smart room systems, security and networking hardware — sourced, supplied, installed and maintained by LodgeCore.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 36 }}>
            <Link href="/book-demo" className="btn btn-primary">Request a quote →</Link>
            <Link href="/services/installation" className="btn btn-outline">Installation services</Link>
          </div>
          <div style={{
            display: "inline-block", padding: "12px 18px",
            background: "rgba(255,190,90,.06)", border: "1px solid rgba(255,190,90,.2)",
            borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6,
          }}>
            <strong style={{ color: "var(--amber)" }}>Hardware supplied by LodgeCore.</strong> All hardware is sourced from verified vendors, supplied and installed by LodgeCore. We do not manufacture hardware.
          </div>
        </div>
      </section>

      {/* Hardware categories */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 48 }}>
            <div className="section-kicker">Hardware Categories</div>
            <h2 className="section-title">Every Category of Property Hardware.</h2>
          </div>
          <div className="hw-grid">
            {CATEGORIES.map((cat) => (
              <Link key={cat.href} href={cat.href} className="hw-card" style={{ textDecoration: "none" }}>
                <div className="hw-card-img">{cat.icon}</div>
                <div className="hw-card-body">
                  <div className="hw-card-name">{cat.name}</div>
                  <div className="hw-card-desc">{cat.desc}</div>
                  <div className="hw-card-tags">
                    {cat.products.slice(0, 4).map((p) => <span key={p} className="hw-tag">{p}</span>)}
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)" }}>View products →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Supply to install */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-kicker">The LodgeCore Approach</div>
            <h2 className="section-title">Hardware is Just the Beginning.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {[
              { icon: "📋", title: "Specification",  desc: "We help you select the right hardware for your property type, infrastructure and budget." },
              { icon: "📦", title: "Supply",         desc: "Hardware delivered to site from verified technology vendors, checked and ready to install." },
              { icon: "🔧", title: "Installation",   desc: "Professional on-site installation by trained LodgeCore technicians." },
              { icon: "🛡️", title: "Care",           desc: "Ongoing maintenance, support and monitoring under LodgeCore Care contracts." },
            ].map((step) => (
              <div key={step.title} className="portal-card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 12 }}>{step.icon}</div>
                <div className="portal-card-title" style={{ justifyContent: "center", marginBottom: 8 }}>{step.title}</div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Need Hardware for Your Property?</h2>
          <p className="cta-body">Talk to the LodgeCore team about hardware selection, supply, installation and integration.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Request a quote →</Link>
            <Link href="/access" className="btn btn-outline btn-lg">LodgeCore Access</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

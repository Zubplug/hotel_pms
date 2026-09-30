import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Hardware — Electronic Locks, Access Control & Smart Systems | LodgeCore",
  description: "Hardware supplied by LodgeCore — electronic locks, RFID access control, smart room systems, security cameras, networking equipment and programming tools.",
};

const CATEGORIES = [
  { href: "/hardware/locks",         img: "/icon-hotel-lock.png",  name: "Electronic Locks",      count: "12+", desc: "RFID, MIFARE, Bluetooth and smart lock solutions for hotels, apartments, offices and homes.",                     products: ["Hotel RFID Locks", "Smart PIN Locks", "Bluetooth Locks", "Fingerprint Locks", "Mortise Sets"] },
  { href: "/hardware/access-control",img: "/icon-access.png",       name: "Access Control",        count: "28+", desc: "Controllers, RFID card readers, electric strikes, magnetic locks and door control hardware.",                   products: ["Access Controllers", "RFID Readers", "Electric Strikes", "Magnetic Locks", "Exit Hardware"] },
  { href: "/hardware/smart-room",    img: "/icon-smart-room.png",  name: "Smart Room Systems",    count: "34+", desc: "Key-card switches, occupancy sensors, thermostats and room control panels for hotels and residences.",           products: ["Key-Card Switches", "Occupancy Sensors", "Thermostats", "Room Panels", "Curtain Controllers"] },
  { href: "/hardware/security",      img: "/icon-care.png",        name: "Security",              count: "45+", desc: "IP cameras, NVR systems, intercom and perimeter security hardware for property protection.",                     products: ["IP Cameras", "NVR Systems", "Intercom Systems", "Video Doorbells", "Gate Controllers"] },
  { href: "/hardware/networking",    img: "/icon-systems.png",     name: "Networking",            count: "19+", desc: "Routers, managed switches, Wi-Fi access points and structured cabling for property networks.",                   products: ["Business Routers", "Managed Switches", "Wi-Fi Access Points", "PoE Switches", "Cabling"] },
  { href: "/hardware/programming",   img: "/icon-pms.png",         name: "Programming Tools",     count: "9+",  desc: "Card encoders, lock programmers and configuration tools for managing access hardware.",                          products: ["Card Encoders", "Handheld Programmers", "USB Programmers", "Blank Key Cards"] },
] as const;

const STEPS = [
  { img: "/icon-pms.png",      title: "Specification",  desc: "We help you select the right hardware for your property type, infrastructure and budget requirements." },
  { img: "/icon-inventory.png",title: "Supply",         desc: "Hardware delivered to site from verified technology vendors, fully checked and ready to install." },
  { img: "/icon-systems.png",  title: "Installation",   desc: "Professional on-site installation by trained LodgeCore technicians across all hardware categories." },
  { img: "/icon-care.png",     title: "Care",           desc: "Ongoing maintenance, monitoring and support under LodgeCore Care contracts. SLA-backed response." },
] as const;

export default function HardwarePage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO ── */}
      <section
        className="div-hero-v2"
        style={{ "--div-color": "#ffbe5a", "--div-color-dim": "rgba(255,190,90,.06)" } as React.CSSProperties}
      >
        <div className="div-hero-v2-glow" />
        <div className="contain">
          <div className="div-hero-v2-grid">
            <div>
              <div className="div-hero-v2-badge">📦 LodgeCore Hardware</div>
              <h1 className="div-hero-v2-h1">
                The Hardware Behind<br /><em>Smarter Properties.</em>
              </h1>
              <p className="div-hero-v2-desc">
                Electronic locks, access control, smart room systems, security and networking hardware — sourced, supplied, installed and maintained by LodgeCore for properties of every type.
              </p>
              <div className="div-hero-v2-ctas">
                <Link href="/book-demo" className="btn btn-primary btn-lg">Request a quote →</Link>
                <Link href="/services/installation" className="btn btn-outline btn-lg">Installation services</Link>
              </div>
              <div className="div-hero-v2-chips">
                {["6 Categories", "Verified Vendors", "On-Site Installation", "LodgeCore Care"].map(c => (
                  <span key={c} className="div-hero-chip">{c}</span>
                ))}
              </div>
            </div>
            <div className="div-hero-v2-img">
              <Image src="/hardware-catalog.png" alt="LodgeCore Hardware Catalog" width={720} height={540} priority />
            </div>
          </div>

          {/* Notice */}
          <div style={{ marginBottom: 48 }}>
            <div className="notice-banner">
              <strong>Hardware supplied by LodgeCore.</strong> All hardware is sourced from verified vendors and supplied, installed and maintained by LodgeCore. We do not manufacture hardware.
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ marginBottom: 56, maxWidth: 600 }}>
            <div className="section-kicker">Hardware Categories</div>
            <h2 className="section-title">Every Category of Property Hardware.</h2>
            <p className="section-body">Six hardware categories covering every aspect of property access, intelligence, security and connectivity — all available through LodgeCore.</p>
          </div>
          <div className="hw-showcase" style={{ "--div-color": "#ffbe5a", "--div-color-dim": "rgba(255,190,90,.06)" } as React.CSSProperties}>
            {CATEGORIES.map(cat => (
              <Link key={cat.href} href={cat.href} className="hw-showcase-card">
                <div className="hw-showcase-visual">
                  <Image src={cat.img} alt={cat.name} width={80} height={80} style={{ borderRadius: 14, objectFit: "cover", position: "relative", zIndex: 1 }} />
                </div>
                <div className="hw-showcase-body">
                  <div className="hw-showcase-count">{cat.count} Products</div>
                  <div className="hw-showcase-name">{cat.name}</div>
                  <div className="hw-showcase-desc">{cat.desc}</div>
                  <div className="cap-tags">
                    {cat.products.slice(0, 4).map(p => <span key={p} className="cap-tag">{p}</span>)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── APPROACH ── */}
      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain">
          <div style={{ marginBottom: 56, textAlign: "center" }}>
            <div className="section-kicker">The LodgeCore Approach</div>
            <h2 className="section-title">Hardware is Just the Beginning.</h2>
            <p className="section-body" style={{ margin: "0 auto" }}>We don&apos;t just drop boxes at your door. Every hardware order comes with professional installation, configuration and integration into your LodgeCore ecosystem.</p>
          </div>
          <div
            className="process-grid"
            style={{ "--div-color": "#ffbe5a", gridTemplateColumns: "repeat(4,1fr)" } as React.CSSProperties}
          >
            {STEPS.map(s => (
              <div key={s.title} className="process-step" style={{ textAlign: "center" }}>
                <div style={{ marginBottom: 16 }}>
                  <Image src={s.img} alt={s.title} width={56} height={56} style={{ borderRadius: 10, objectFit: "cover" }} />
                </div>
                <div className="process-label">{s.title}</div>
                <div className="process-sub">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATALOG IMAGE ── */}
      <section className="section-gap">
        <div className="contain">
          <div className="eco-panel" style={{ "--div-color": "#ffbe5a", "--div-color-dim": "rgba(255,190,90,.06)" } as React.CSSProperties}>
            <div>
              <div className="section-kicker">Full Catalog</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>Source, Supply and Install — End to End.</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 24 }}>
                LodgeCore maintains relationships with leading access technology, smart room and security hardware vendors. We source the right products, deliver to site, install professionally and integrate with your LodgeCore software platform.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 28 }}>
                <Link href="/book-demo" className="btn btn-primary">Request a quote →</Link>
                <Link href="/access" className="btn btn-outline">LodgeCore Access</Link>
              </div>
            </div>
            <div className="eco-img">
              <Image src="/hardware-catalog.png" alt="Hardware Catalog" width={580} height={440} />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Need Hardware for Your Property?</h2>
          <p className="cta-body">Talk to the LodgeCore team about hardware selection, supply, installation and integration into your property technology stack.</p>
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

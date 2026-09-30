import type { Metadata } from "next";
import Image from "next/image";
import { PublicHeader, PublicFooter } from "@/components/public-shell";
import Link from "next/link";

const PAGES: Record<string, {
  title: string; desc: string; metaTitle: string; metaDesc: string;
  color: string; colorDim: string; icon: string;
  intro: string;
  features: string[]; related: { href: string; label: string }[];
  image: string;
}> = {
  "smart-hotel": {
    title: "Smart Hotel Rooms",
    desc: "Energy management, key-card switches, occupancy sensors, smart AC and lighting automation for hotel guestrooms and common areas.",
    metaTitle: "Smart Hotel Room Technology — LodgeCore Smart",
    metaDesc: "LodgeCore Smart provides hotel room energy management, occupancy sensors, smart AC and lighting automation integrated with the PMS.",
    color: "#a78bfa", colorDim: "rgba(167,139,250,.06)",
    icon: "🏨",
    image: "/smart-dashboard.png",
    intro: "LodgeCore Smart hotel room technology activates automatically at check-in, manages climate and lighting based on real-time occupancy, and powers down entirely at checkout — cutting energy waste and elevating every guest's experience.",
    features: [
      "Key-card energy switch at room entry — activates power on card insert",
      "Occupancy and motion sensor integration for intelligent automation",
      "Smart thermostat and AC control with temperature scheduling",
      "Automated lighting control — arrival, sleep, away and cleaning scenes",
      "Motorised curtain and blind automation",
      "DND and Make Up Room panel with direct PMS status sync",
      "Guest room control panel with simple one-touch interface",
      "PMS integration — automatic room activation on check-in confirmation",
      "Real-time energy monitoring and consumption reporting per room",
      "Remote diagnostics and management from central dashboard",
    ],
    related: [
      { href: "/hospitality/housekeeping", label: "Housekeeping Integration" },
      { href: "/smart/energy-management", label: "Energy Management" },
      { href: "/access/hotel-locks", label: "Hotel Locks" },
      { href: "/smart", label: "All Smart Products" },
    ],
  },
  "smart-home": {
    title: "Smart Homes",
    desc: "Smart locks, lighting, switches, sockets, AC control, motorised curtains and complete home automation for residential properties.",
    metaTitle: "Smart Home Technology — LodgeCore Smart",
    metaDesc: "LodgeCore Smart provides smart home technology including locks, lighting, AC control and home automation for residential properties.",
    color: "#a78bfa", colorDim: "rgba(167,139,250,.06)",
    icon: "🏠",
    image: "/smart-room.png",
    intro: "LodgeCore Smart brings professional-grade home intelligence to residential properties — from smart locks and lighting to full climate control and automation scenes, all remotely manageable from a single mobile interface.",
    features: [
      "Smart locks with mobile app, PIN and Bluetooth access",
      "Smart lighting switches and dimmers with remote control",
      "Smart power sockets with energy monitoring",
      "Motorised curtain and blind control with scheduling",
      "Smart AC and thermostat control with temperature zones",
      "Smart video doorbell and intercom",
      "Smart gate and perimeter access control",
      "Home automation scenes and time-based schedules",
      "Remote monitoring and control via mobile app",
      "Energy consumption monitoring and historical reporting",
    ],
    related: [
      { href: "/access/smart-locks", label: "Smart Locks" },
      { href: "/solutions/homes", label: "Homes Solution" },
      { href: "/smart/energy-management", label: "Energy Management" },
    ],
  },
  "smart-building": {
    title: "Smart Buildings",
    desc: "Building automation, energy management, occupancy monitoring and access management for commercial and multi-tenancy buildings.",
    metaTitle: "Smart Building Technology — LodgeCore Smart",
    metaDesc: "LodgeCore Smart provides building automation, energy management and access control for commercial buildings.",
    color: "#a78bfa", colorDim: "rgba(167,139,250,.06)",
    icon: "🏗",
    image: "/smart-dashboard.png",
    intro: "LodgeCore Smart building technology connects HVAC, lighting, access control and energy management into one centralised building intelligence platform — giving facilities managers real-time visibility and control across every floor and zone.",
    features: [
      "Building management system (BMS) integration",
      "Centralised energy monitoring and control by floor and zone",
      "Occupancy tracking across floors, zones and meeting rooms",
      "Smart meeting room availability and booking management",
      "Tenant and visitor access control management",
      "HVAC optimisation and intelligent scheduling",
      "IoT sensor network installation and management",
      "Remote monitoring and facilities management dashboard",
      "Fault detection alerts and automated maintenance notifications",
      "Sustainability, carbon and energy efficiency reporting",
    ],
    related: [
      { href: "/access/access-control", label: "Access Control" },
      { href: "/solutions/commercial", label: "Commercial Buildings" },
      { href: "/smart/energy-management", label: "Energy Management" },
    ],
  },
  "energy-management": {
    title: "Energy Management",
    desc: "Monitor, control and optimise energy consumption across your property with smart meters, IoT sensors and intelligent automation.",
    metaTitle: "Property Energy Management — LodgeCore Smart",
    metaDesc: "LodgeCore Smart energy management monitors and optimises electricity and energy use across hotels, homes and commercial buildings.",
    color: "#a78bfa", colorDim: "rgba(167,139,250,.06)",
    icon: "⚡",
    image: "/smart-dashboard.png",
    intro: "LodgeCore Smart energy management gives property operators complete visibility and intelligent control over energy consumption — reducing costs, minimising waste and supporting sustainability targets.",
    features: [
      "Real-time energy monitoring by zone, floor and room",
      "Smart meter and sub-meter integration",
      "Automated load shedding and peak demand management",
      "Occupancy-based HVAC optimisation and scheduling",
      "Solar and renewable energy source integration",
      "Energy consumption dashboards with historical trend analysis",
      "Anomaly detection and waste alert notifications",
      "Benchmarking against targets and performance KPIs",
      "Carbon footprint and sustainability reporting",
      "Integration with BMS and all building systems",
    ],
    related: [
      { href: "/smart/smart-hotel", label: "Smart Hotel Rooms" },
      { href: "/smart/smart-building", label: "Smart Buildings" },
      { href: "/smart/automation", label: "Automation" },
    ],
  },
  automation: {
    title: "Property Automation",
    desc: "Scenes, schedules, rules and triggers for automating any aspect of your property — from lighting and AC to access control and energy.",
    metaTitle: "Property Automation — LodgeCore Smart",
    metaDesc: "LodgeCore Smart property automation with scenes, schedules, rules and triggers for hotels, homes and commercial buildings.",
    color: "#a78bfa", colorDim: "rgba(167,139,250,.06)",
    icon: "🤖",
    image: "/smart-dashboard.png",
    intro: "LodgeCore Smart automation transforms your property into an intelligent, self-managing system — with rule-based triggers, time schedules, occupancy logic and multi-step sequences that handle routine operations automatically.",
    features: [
      "Scene-based automation for rooms, floors and zones",
      "Time-based scheduling for all connected systems",
      "Occupancy-triggered automation rules via sensor integration",
      "Event-based triggers from PMS check-in and checkout",
      "Conditional logic and multi-step automation sequences",
      "Temperature, humidity and air quality trigger automation",
      "Integration with third-party smart devices and platforms",
      "Remote override and manual control capability",
      "Full automation audit log and change history",
      "Mobile app monitoring, override and control interface",
    ],
    related: [
      { href: "/smart/smart-hotel", label: "Smart Hotel Rooms" },
      { href: "/smart/energy-management", label: "Energy Management" },
      { href: "/systems", label: "LodgeCore Systems" },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return { title: page?.metaTitle ?? "LodgeCore Smart", description: page?.metaDesc ?? "" };
}

export default async function SmartSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];

  if (!page) {
    return (
      <main className="site-shell">
        <PublicHeader />
        <section style={{ paddingTop: 160, paddingBottom: 80, textAlign: "center" }}>
          <div className="contain">
            <div className="section-kicker">LodgeCore Smart</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700, marginBottom: 16 }}>Coming Soon</h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>This page is being prepared. Contact us to learn more.</p>
            <Link href="/smart" className="btn btn-outline">← Back to Smart</Link>
          </div>
        </section>
        <PublicFooter />
      </main>
    );
  }

  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO ── */}
      <section
        className="div-hero-v2"
        style={{ "--div-color": page.color, "--div-color-dim": page.colorDim } as React.CSSProperties}
      >
        <div className="div-hero-v2-glow" />
        <div className="contain">
          <div className="div-hero-v2-grid">
            <div>
              <div className="div-hero-v2-badge">{page.icon} LodgeCore Smart</div>
              <h1 className="div-hero-v2-h1" style={{ fontSize: "clamp(2.2rem,4vw,3.4rem)" }}>
                {page.title}
              </h1>
              <p className="div-hero-v2-desc">{page.intro}</p>
              <div className="div-hero-v2-ctas">
                <Link href="/book-demo" className="btn btn-primary btn-lg">Request a consultation →</Link>
                <Link href="/smart" className="btn btn-outline btn-lg">All Smart products</Link>
              </div>
            </div>
            <div className="div-hero-v2-img">
              <Image src={page.image} alt={page.title} width={720} height={540} priority />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="section-gap">
        <div className="contain">
          <div
            className="eco-panel"
            style={{ "--div-color": page.color, "--div-color-dim": page.colorDim } as React.CSSProperties}
          >
            <div>
              <div className="section-kicker">Key Capabilities</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.5rem,3vw,2rem)" }}>What&apos;s Included.</h2>
              <div className="feature-list">
                {page.features.map(f => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="cap-card" style={{ "--div-color": page.color, "--div-color-dim": page.colorDim } as React.CSSProperties}>
                <div className="cap-name">Request a consultation</div>
                <div className="cap-desc">Talk to the LodgeCore Smart team about smart technology for your property. We&apos;ll assess your requirements and recommend the right solution.</div>
                <Link href="/book-demo" className="btn btn-primary" style={{ border: "none", display: "block", textAlign: "center", marginTop: 8 }}>Contact LodgeCore →</Link>
              </div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-card)", borderRadius: "var(--radius-xl)", padding: 24 }}>
                <div className="cap-name" style={{ marginBottom: 14 }}>Related</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {page.related.map(r => (
                    <Link
                      key={r.href}
                      href={r.href}
                      style={{ fontSize: 13, color: "var(--accent)", padding: "10px 0", borderBottom: "1px solid var(--border-card)", display: "block", fontFamily: "var(--font-mono)", letterSpacing: ".05em" }}
                    >
                      {r.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">LodgeCore Smart</div>
          <h2 className="cta-title">Make Your Property Smarter.</h2>
          <p className="cta-body">Talk to the LodgeCore team about smart technology, energy management and intelligent automation for your property.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Talk to an expert →</Link>
            <Link href="/smart" className="btn btn-outline btn-lg">All Smart products</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map(slug => ({ slug }));
}

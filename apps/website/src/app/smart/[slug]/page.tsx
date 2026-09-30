import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import Link from "next/link";

const PAGES: Record<string, {
  title: string; desc: string; metaTitle: string; metaDesc: string;
  features: string[]; related: { href: string; label: string }[];
}> = {
  "smart-hotel": {
    title: "Smart Hotel Rooms",
    desc: "Energy management, key-card switches, occupancy sensors, smart AC and lighting automation for hotel guestrooms and common areas.",
    metaTitle: "Smart Hotel Room Technology — LodgeCore Smart",
    metaDesc: "LodgeCore Smart provides hotel room energy management, occupancy sensors, smart AC and lighting automation integrated with the PMS.",
    features: [
      "Key-card energy switches at room entry",
      "Occupancy and motion sensor integration",
      "Smart thermostat and AC control",
      "Automated lighting control and scenes",
      "Curtain and blind motorisation",
      "DND and Make Up Room panel integration",
      "Guest room panel and control interface",
      "PMS integration for automatic room activation at check-in",
      "Energy monitoring and reporting by room",
      "Remote diagnostics and management from central dashboard",
    ],
    related: [
      { href: "/hospitality/housekeeping", label: "Housekeeping Integration" },
      { href: "/smart/energy-management", label: "Energy Management" },
      { href: "/access/hotel-locks", label: "Hotel Locks" },
    ],
  },
  "smart-home": {
    title: "Smart Homes",
    desc: "Smart locks, lighting, switches, sockets, AC control, curtains and complete home automation for residential properties.",
    metaTitle: "Smart Home Technology — LodgeCore Smart",
    metaDesc: "LodgeCore Smart provides smart home technology including locks, lighting, AC control and automation for residential properties.",
    features: [
      "Smart locks with mobile and PIN access",
      "Smart lighting switches and dimmers",
      "Smart power sockets and energy monitoring",
      "Motorised curtain and blind control",
      "Smart AC and thermostat control",
      "Smart doorbell and intercom",
      "Smart gate and perimeter access control",
      "Home automation scenes and schedules",
      "Remote monitoring and control via mobile",
      "Energy consumption monitoring and reporting",
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
    features: [
      "Building management system (BMS) integration",
      "Centralised energy monitoring and control",
      "Occupancy tracking across floors and zones",
      "Smart meeting room management",
      "Access control for tenants and visitors",
      "HVAC optimisation and scheduling",
      "IoT sensor network installation",
      "Remote monitoring and facilities management dashboard",
      "Fault detection and maintenance alerts",
      "Sustainability and carbon reporting",
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
    features: [
      "Real-time energy monitoring by zone and room",
      "Smart meter and sub-meter integration",
      "Automated load shedding and peak demand management",
      "Occupancy-based HVAC optimisation",
      "Solar and renewable energy source integration",
      "Energy consumption dashboards and historical reports",
      "Anomaly detection and waste alerts",
      "Benchmarking against targets and performance KPIs",
      "Carbon footprint and sustainability reporting",
      "Integration with BMS and building systems",
    ],
    related: [
      { href: "/smart/smart-hotel", label: "Smart Hotel Rooms" },
      { href: "/smart/smart-building", label: "Smart Buildings" },
      { href: "/smart/automation", label: "Automation" },
    ],
  },
  automation: {
    title: "Property Automation",
    desc: "Scenes, schedules, rules and triggers for automating any aspect of your property — from lighting and AC to access and energy.",
    metaTitle: "Property Automation — LodgeCore Smart",
    metaDesc: "LodgeCore Smart property automation with scenes, schedules, rules and triggers for hotels, homes and commercial buildings.",
    features: [
      "Scene-based automation for rooms and zones",
      "Time-based scheduling for all systems",
      "Occupancy-triggered automation rules",
      "Event-based triggers from PMS or access system",
      "Conditional logic and multi-step automation sequences",
      "Temperature, humidity and air quality triggers",
      "Integration with third-party smart devices",
      "Remote override and manual control capability",
      "Automation audit log and change reporting",
      "Mobile app monitoring and control",
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
      <PublicShell eyebrow="LodgeCore Smart" title="Coming Soon" description="This page is being prepared. Contact us to learn more.">
        <section className="section-gap">
          <div className="contain" style={{ textAlign: "center" }}>
            <Link href="/smart" className="btn btn-outline">← Back to Smart</Link>
          </div>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell eyebrow="LodgeCore Smart" title={page.title} description={page.desc}>
      <section className="section-gap">
        <div className="contain">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
            <div>
              <div className="section-kicker">Key Capabilities</div>
              <h2 className="section-title" style={{ fontSize: "1.8rem", marginBottom: 28 }}>What&apos;s Included.</h2>
              <div className="feature-list">
                {page.features.map((f) => (
                  <div key={f} className="feature-list-item">
                    <div className="feature-list-check">✓</div><span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="portal-card">
                <div className="portal-card-title">Request a consultation</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7 }}>
                  Talk to the LodgeCore Smart team about smart technology for your property.
                </p>
                <Link href="/book-demo" className="btn btn-primary" style={{ border: "none", display: "block", textAlign: "center" }}>Contact LodgeCore →</Link>
              </div>
              <div className="portal-card" style={{ background: "transparent", border: "1px solid var(--border)" }}>
                <div className="portal-card-title">Related</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {page.related.map((r) => (
                    <Link key={r.href} href={r.href} style={{ fontSize: 13, color: "var(--accent)", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      {r.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Make Your Property Smarter.</h2>
          <p className="cta-body">Talk to the LodgeCore team about smart technology and automation for your property.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Talk to an expert →</Link>
            <Link href="/smart" className="btn btn-outline btn-lg">All smart products</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import Link from "next/link";

const PAGES: Record<string, {
  title: string; desc: string; metaTitle: string; metaDesc: string;
  products: { label: string; href: string; desc: string }[];
  features: string[];
}> = {
  hotels: {
    title: "Hotels & Resorts",
    desc: "The complete technology stack for hotels and resorts — from PMS and POS to electronic locks, smart rooms, access control and full property operations.",
    metaTitle: "Hotel Technology Solutions — LodgeCore",
    metaDesc: "LodgeCore provides complete hotel technology: PMS, POS, booking engine, electronic locks, smart rooms and access control for hotels and resorts.",
    products: [
      { label: "LodgeCore PMS",          href: "/hospitality/pms",         desc: "Property management, reservations and guest folios" },
      { label: "Point of Sale",          href: "/hospitality/pos",         desc: "Restaurant, bar and room service POS" },
      { label: "Booking Engine",         href: "/hospitality/booking",     desc: "Direct bookings and OTA channel management" },
      { label: "Hotel Electronic Locks", href: "/access/hotel-locks",      desc: "RFID and MIFARE guestroom locks" },
      { label: "Access Control",         href: "/access/access-control",   desc: "Common area and back-of-house access" },
      { label: "Smart Hotel Rooms",      href: "/smart/smart-hotel",       desc: "Energy, AC, lighting and occupancy sensors" },
      { label: "Housekeeping",           href: "/hospitality/housekeeping",desc: "Room readiness and task management" },
      { label: "Finance & Accounting",   href: "/hospitality/accounting",  desc: "Folios, audit, billing and reporting" },
    ],
    features: [
      "Fully integrated PMS, POS and booking engine",
      "Electronic locks integrated with PMS for automated key issuance",
      "Smart room automation linked to reservation status",
      "End-to-end deployment by LodgeCore Systems",
      "Ongoing support under LodgeCore Care",
    ],
  },
  apartments: {
    title: "Apartments",
    desc: "Property management, access control and smart technology for serviced apartment operators and residential apartment managers.",
    metaTitle: "Apartment Management Technology — LodgeCore",
    metaDesc: "LodgeCore provides property management, smart access, smart locks and automation for serviced and residential apartment operators.",
    products: [
      { label: "Smart Locks",    href: "/access/smart-locks",    desc: "PIN, Bluetooth and mobile key apartment locks" },
      { label: "Access Control", href: "/access/access-control", desc: "Building entrance and common area access" },
      { label: "Smart Home",     href: "/smart/smart-home",      desc: "Lighting, AC and home automation" },
      { label: "LodgeCore PMS",  href: "/hospitality/pms",       desc: "Short-term and serviced apartment management" },
    ],
    features: [
      "Remote tenant and guest access management",
      "Building entrance and lift access control",
      "Smart home automation for individual units",
      "Centralised property management across the portfolio",
      "Maintenance management and LodgeCore Care support",
    ],
  },
  "short-let": {
    title: "Short-Let Properties",
    desc: "Remote guest access, automated check-in, energy management and property monitoring for short-let and holiday rental operators.",
    metaTitle: "Short-Let Property Technology — LodgeCore",
    metaDesc: "LodgeCore provides smart locks, remote access, energy management and property monitoring for short-let and holiday rental operators.",
    products: [
      { label: "Smart Locks",       href: "/access/smart-locks",        desc: "PIN and mobile key remote access" },
      { label: "Energy Management", href: "/smart/energy-management",   desc: "Remote energy monitoring and control" },
      { label: "Automation",        href: "/smart/automation",          desc: "Automated check-in and room activation" },
      { label: "Smart Home",        href: "/smart/smart-home",          desc: "Lighting, AC and home control" },
    ],
    features: [
      "Remote keyless guest access via PIN or mobile",
      "Automated energy management between guest stays",
      "Remote property monitoring and alerts",
      "Scalable across single properties and large portfolios",
      "LodgeCore Care maintenance and support",
    ],
  },
  homes: {
    title: "Homes",
    desc: "Smart locks, lighting, AC control, security cameras and home automation for residential properties — installed and maintained by LodgeCore.",
    metaTitle: "Smart Home Technology — LodgeCore",
    metaDesc: "LodgeCore installs smart locks, lighting, AC control and home automation for residential properties.",
    products: [
      { label: "Smart Locks",   href: "/access/smart-locks",    desc: "Keyless entry for your home" },
      { label: "Smart Home",    href: "/smart/smart-home",      desc: "Lighting, AC and full home automation" },
      { label: "Security",      href: "/hardware/security",     desc: "CCTV and intercom systems" },
      { label: "Energy Mgmt",   href: "/smart/energy-management",desc: "Monitor and control home energy" },
    ],
    features: [
      "Smart locks with mobile and PIN access for the whole family",
      "Automated lighting, curtains and climate control",
      "Security cameras and video doorbell",
      "Energy monitoring and smart socket control",
      "Installation and ongoing maintenance by LodgeCore",
    ],
  },
  offices: {
    title: "Offices",
    desc: "Access control, visitor management, smart building automation and energy management for office environments.",
    metaTitle: "Office Technology Solutions — LodgeCore",
    metaDesc: "LodgeCore provides access control, visitor management, smart building automation and energy management for offices.",
    products: [
      { label: "Access Control",  href: "/access/access-control",  desc: "Door access for staff and visitors" },
      { label: "Smart Building",  href: "/smart/smart-building",   desc: "Building automation and energy management" },
      { label: "Security",        href: "/hardware/security",      desc: "CCTV and intercom" },
      { label: "Networking",      href: "/hardware/networking",    desc: "Office network infrastructure" },
    ],
    features: [
      "Multi-door access control with staff and visitor management",
      "Time-based access scheduling by floor and zone",
      "Smart meeting room climate and lighting control",
      "Energy monitoring and optimisation",
      "Visitor management and intercom integration",
    ],
  },
  commercial: {
    title: "Commercial Buildings",
    desc: "Building management systems, energy monitoring, access infrastructure and security for commercial and multi-tenancy properties.",
    metaTitle: "Commercial Building Technology — LodgeCore",
    metaDesc: "LodgeCore provides building management, energy monitoring, access control and security for commercial buildings.",
    products: [
      { label: "Smart Building",  href: "/smart/smart-building",   desc: "BMS integration and building automation" },
      { label: "Access Control",  href: "/access/access-control",  desc: "Multi-floor tenant access management" },
      { label: "Energy Mgmt",     href: "/smart/energy-management",desc: "Building energy monitoring" },
      { label: "Security",        href: "/hardware/security",      desc: "CCTV and perimeter security" },
    ],
    features: [
      "Multi-tenant access control with individual permissions",
      "Building energy monitoring and sustainability reporting",
      "HVAC automation and occupancy-based control",
      "Security cameras and perimeter monitoring",
      "LodgeCore Systems for full deployment and integration",
    ],
  },
  estates: {
    title: "Estates",
    desc: "Gate access, smart homes, perimeter security and integrated estate technology management for large residential and mixed-use estates.",
    metaTitle: "Estate Technology Solutions — LodgeCore",
    metaDesc: "LodgeCore provides gate access, smart home technology, perimeter security and estate management technology.",
    products: [
      { label: "Access Control",  href: "/access/access-control",  desc: "Gate and perimeter access management" },
      { label: "Smart Home",      href: "/smart/smart-home",       desc: "Individual home automation" },
      { label: "Security",        href: "/hardware/security",      desc: "Estate CCTV and intercom" },
      { label: "Smart Building",  href: "/smart/smart-building",   desc: "Communal building automation" },
    ],
    features: [
      "Vehicle and pedestrian gate access control",
      "Smart home technology for individual units",
      "Estate-wide CCTV and perimeter monitoring",
      "Communal area access and management",
      "LodgeCore Care maintenance contracts for the estate",
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return { title: page?.metaTitle ?? "LodgeCore Solutions", description: page?.metaDesc ?? "" };
}

export default async function SolutionSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) {
    return (
      <PublicShell eyebrow="Solutions" title="Coming Soon" description="This solution page is being prepared.">
        <section className="section-gap">
          <div className="contain" style={{ textAlign: "center" }}>
            <Link href="/solutions" className="btn btn-outline">← All solutions</Link>
          </div>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell eyebrow="LodgeCore Solutions" title={page.title} description={page.desc}>
      <section className="section-gap">
        <div className="contain">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "start" }}>
            {/* Products */}
            <div>
              <div className="section-kicker">Recommended Products</div>
              <h2 className="section-title" style={{ fontSize: "1.8rem", marginBottom: 28 }}>What LodgeCore Provides.</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {page.products.map((p) => (
                  <Link key={p.href} href={p.href} className="sol-product-link">
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.02em" }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.desc}</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", flexShrink: 0 }}>→</span>
                  </Link>
                ))}
              </div>
            </div>
            {/* Highlights + CTA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="portal-card">
                <div className="portal-card-title">Key highlights</div>
                <div className="feature-list" style={{ marginTop: 8 }}>
                  {page.features.map((f) => (
                    <div key={f} className="feature-list-item">
                      <div className="feature-list-check">✓</div><span style={{ fontSize: 13 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="portal-card" style={{ background: "transparent", border: "1px solid var(--accent)", textAlign: "center" }}>
                <div className="portal-card-title" style={{ justifyContent: "center", color: "var(--text-primary)", marginBottom: 8 }}>Talk to our team</div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7 }}>
                  We&apos;ll design a solution tailored to your {page.title.toLowerCase()} requirements.
                </p>
                <Link href="/book-demo" className="btn btn-primary" style={{ border: "none", display: "block" }}>Book a consultation →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Ready to Upgrade Your Property?</h2>
          <p className="cta-body">Talk to LodgeCore about technology solutions for your {page.title.toLowerCase()}.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Book a demo →</Link>
            <Link href="/solutions" className="btn btn-outline btn-lg">All solutions</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

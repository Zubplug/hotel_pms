import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import Link from "next/link";

const PAGES: Record<string, {
  title: string; desc: string; metaTitle: string; metaDesc: string;
  families: { name: string; items: string[] }[]; related: { href: string; label: string }[];
}> = {
  locks: {
    title: "Electronic Locks",
    desc: "Hotel RFID locks, smart locks, PIN locks, Bluetooth locks and fingerprint locks. All hardware supplied by LodgeCore.",
    metaTitle: "Electronic Locks — LodgeCore Hardware",
    metaDesc: "Hotel RFID locks, smart locks, Bluetooth, PIN and fingerprint locks supplied, installed and maintained by LodgeCore.",
    families: [
      { name: "Hotel RFID Locks",  items: ["Mortise RFID Lock", "Handle Set RFID Lock", "Rim RFID Lock", "Safe RFID Lock"] },
      { name: "Smart Locks",       items: ["Bluetooth Smart Lock", "Wi-Fi Smart Lock", "PIN + Bluetooth Combo", "Fingerprint Smart Lock"] },
      { name: "Common Area Locks", items: ["Stairwell Lock", "Pool & Gym Lock", "Staff Room Lock", "Laundry Room Lock"] },
    ],
    related: [
      { href: "/access/hotel-locks", label: "Hotel Locks — LodgeCore Access" },
      { href: "/hardware/access-control", label: "Access Control Hardware" },
      { href: "/services/installation", label: "Installation Services" },
    ],
  },
  "access-control": {
    title: "Access Control",
    desc: "Controllers, RFID readers, electric strikes, magnetic locks, exit hardware and door control components.",
    metaTitle: "Access Control Hardware — LodgeCore",
    metaDesc: "Access controllers, RFID readers, electric strikes and magnetic locks supplied and installed by LodgeCore.",
    families: [
      { name: "Controllers", items: ["Single Door Controller", "Multi-Door Controller", "IP Network Controller", "Standalone Controller"] },
      { name: "Readers",     items: ["RFID Card Reader", "Contactless Reader", "Dual-Tech Reader", "Long-Range Reader"] },
      { name: "Strikes & Locks", items: ["Electric Strike", "Magnetic Lock", "Electromagnetic Lock", "Electric Bolt"] },
    ],
    related: [
      { href: "/access/access-control", label: "Access Control — LodgeCore Access" },
      { href: "/hardware/locks", label: "Electronic Locks" },
      { href: "/services/installation", label: "Installation" },
    ],
  },
  "smart-room": {
    title: "Smart Room Systems",
    desc: "Key-card energy switches, occupancy sensors, smart thermostats, room control panels and smart sockets for hotel guestrooms and residences.",
    metaTitle: "Smart Room Hardware — LodgeCore",
    metaDesc: "Hotel smart room hardware including key-card switches, occupancy sensors, smart AC controllers and room panels supplied by LodgeCore.",
    families: [
      { name: "Energy Control",  items: ["Key-Card Energy Switch", "Smart Socket", "Smart Power Strip", "Energy Meter"] },
      { name: "Climate",         items: ["Smart Thermostat", "AC Controller", "FCU Controller", "Humidity Sensor"] },
      { name: "Room Control",    items: ["Guest Room Panel", "DND / MUR Panel", "Curtain Controller", "Motorised Blind"] },
    ],
    related: [
      { href: "/smart/smart-hotel", label: "Smart Hotel Rooms" },
      { href: "/smart/energy-management", label: "Energy Management" },
      { href: "/services/installation", label: "Installation" },
    ],
  },
  security: {
    title: "Security",
    desc: "IP cameras, NVR/DVR systems, video intercom, doorbell cameras and perimeter security hardware for properties.",
    metaTitle: "Security Hardware — LodgeCore",
    metaDesc: "Security cameras, NVR systems, intercom and perimeter hardware supplied and installed by LodgeCore.",
    families: [
      { name: "Cameras",   items: ["Indoor IP Camera", "Outdoor IP Camera", "PTZ Camera", "Dome Camera", "Fisheye Camera"] },
      { name: "Recording", items: ["4-Channel NVR", "8-Channel NVR", "16-Channel NVR", "Cloud Recording"] },
      { name: "Intercom",  items: ["Video Doorbell", "IP Intercom Station", "Apartment Intercom", "Gate Intercom"] },
    ],
    related: [
      { href: "/access/access-control", label: "Access Control" },
      { href: "/solutions/hotels", label: "Hotels Solution" },
      { href: "/services/installation", label: "Installation" },
    ],
  },
  networking: {
    title: "Networking",
    desc: "Business routers, managed switches, Wi-Fi access points and PoE infrastructure for property networks.",
    metaTitle: "Networking Hardware — LodgeCore",
    metaDesc: "Business networking hardware including routers, switches, Wi-Fi access points and PoE infrastructure supplied by LodgeCore.",
    families: [
      { name: "Routers & Firewalls", items: ["Business Router", "Security Gateway", "SD-WAN Router", "4G/5G Router"] },
      { name: "Switches",            items: ["Unmanaged Switch", "Managed Switch", "PoE Switch", "Core Switch"] },
      { name: "Wi-Fi",               items: ["Indoor AP", "Outdoor AP", "High-Density AP", "Wi-Fi Controller"] },
    ],
    related: [
      { href: "/smart/smart-building", label: "Smart Buildings" },
      { href: "/services/installation", label: "Installation" },
      { href: "/services/integration", label: "Integration" },
    ],
  },
  programming: {
    title: "Programming Tools",
    desc: "Card encoders, handheld and USB lock programmers, blank key cards and configuration tools for managing access hardware.",
    metaTitle: "Lock Programming Tools — LodgeCore Hardware",
    metaDesc: "Card encoders, handheld programmers and USB programming tools for hotel electronic lock systems. Supplied by LodgeCore.",
    families: [
      { name: "Card Encoders",  items: ["Desktop Card Encoder", "USB Encoder", "Network Encoder", "Encoder Software"] },
      { name: "Programmers",    items: ["Handheld Programmer", "USB Lock Programmer", "Bluetooth Programmer"] },
      { name: "Consumables",    items: ["RFID Key Cards (100 pack)", "MIFARE Key Cards", "Key Card Holders", "Wristbands"] },
    ],
    related: [
      { href: "/access/encoders", label: "Card Encoders — LodgeCore Access" },
      { href: "/access/programmers", label: "Lock Programmers" },
      { href: "/services/maintenance", label: "Maintenance" },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return { title: page?.metaTitle ?? "LodgeCore Hardware", description: page?.metaDesc ?? "" };
}

export default async function HardwareSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) {
    return (
      <PublicShell eyebrow="LodgeCore Hardware" title="Coming Soon" description="This hardware category page is being prepared.">
        <section className="section-gap">
          <div className="contain" style={{ textAlign: "center" }}>
            <Link href="/hardware" className="btn btn-outline">← Back to Hardware</Link>
          </div>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell eyebrow="LodgeCore Hardware" title={page.title} description={page.desc}>
      {/* Disclaimer */}
      <div className="contain" style={{ padding: "0 28px 28px" }}>
        <div style={{ padding: "12px 18px", borderRadius: "var(--radius-md)", background: "rgba(255,190,90,.06)", border: "1px solid rgba(255,190,90,.2)", fontSize: 12, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--amber)" }}>Hardware supplied by LodgeCore.</strong> All hardware listed is sourced from verified vendors, supplied and installed by LodgeCore. Pricing on request.
        </div>
      </div>

      {/* Product families */}
      <section className="section-gap" style={{ paddingTop: 0 }}>
        <div className="contain">
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 40, alignItems: "start" }}>
            <div>
              <div className="section-kicker">Product Families</div>
              <h2 className="section-title" style={{ fontSize: "1.8rem", marginBottom: 32 }}>Available Hardware.</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {page.families.map((fam) => (
                  <div key={fam.name} style={{ border: "1px solid var(--border-card)", borderRadius: "var(--radius-lg)", background: "var(--bg-card)", overflow: "hidden" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.02em" }}>
                      {fam.name}
                    </div>
                    <div style={{ padding: "14px 20px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {fam.items.map((item) => (
                        <span key={item} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "5px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg-overlay)" }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="portal-card">
                <div className="portal-card-title">Request a quote</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7 }}>
                  Talk to the LodgeCore team about hardware selection, supply, delivery and installation for your property.
                </p>
                <Link href="/book-demo" className="btn btn-primary" style={{ border: "none", display: "block", textAlign: "center" }}>Request quote →</Link>
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
          <h2 className="cta-title">Ready to Equip Your Property?</h2>
          <p className="cta-body">Get in touch with the LodgeCore team for hardware pricing, availability and installation.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Request a quote →</Link>
            <Link href="/hardware" className="btn btn-outline btn-lg">All hardware</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

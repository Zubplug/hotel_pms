import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import Link from "next/link";

const PAGES: Record<string, {
  title: string; desc: string; metaTitle: string; metaDesc: string;
  features: string[]; related: { href: string; label: string }[];
}> = {
  "hotel-locks": {
    title: "Hotel Electronic Locks",
    desc: "RFID and MIFARE electronic locks for hotel guestrooms, suites and common areas. Supplied, installed and integrated with the LodgeCore PMS.",
    metaTitle: "Hotel Electronic Locks — LodgeCore Access",
    metaDesc: "RFID and MIFARE hotel locks supplied, installed and configured by LodgeCore. Integrated with LodgeCore PMS for automatic key issuance.",
    features: [
      "RFID and MIFARE lock technology for hotel guestrooms",
      "Electronic mortise, handle set and rim lock configurations",
      "Anti-panic and emergency exit compliance",
      "Master card and staff key hierarchy management",
      "Door status monitoring (open, locked, DND)",
      "Audit log of all access events",
      "Low battery detection and alerts",
      "PMS integration for automatic key issuance at check-in",
      "Compatible with hotel safes and common area locks",
      "Installation and configuration by LodgeCore technicians",
    ],
    related: [
      { href: "/access/encoders", label: "Card Encoders" },
      { href: "/hospitality/pms", label: "PMS Integration" },
      { href: "/access/access-control", label: "Access Control" },
      { href: "/services/installation", label: "Installation" },
    ],
  },
  "smart-locks": {
    title: "Smart Locks",
    desc: "PIN, Bluetooth, mobile key and biometric smart lock solutions for apartments, offices, homes and modern access requirements.",
    metaTitle: "Smart Locks — LodgeCore Access",
    metaDesc: "Bluetooth, PIN, mobile key and fingerprint smart locks from LodgeCore for apartments, offices and residential properties.",
    features: [
      "PIN code access with full audit trail",
      "Bluetooth and mobile key access via smartphone",
      "Fingerprint biometric lock options",
      "Remote lock management and access sharing",
      "Temporary access codes for guests and contractors",
      "Auto-lock and real-time status monitoring",
      "Wi-Fi connected locks with cloud management",
      "Long-life battery with low battery alerts",
      "Suitable for apartments, serviced units and short-let properties",
      "Integration with property management systems",
    ],
    related: [
      { href: "/access/hotel-locks", label: "Hotel Locks" },
      { href: "/solutions/short-let", label: "Short-Let Solution" },
      { href: "/solutions/apartments", label: "Apartments Solution" },
    ],
  },
  "access-control": {
    title: "Access Control",
    desc: "Controllers, RFID readers, electric strikes, magnetic locks, door sensors and exit hardware for comprehensive property access management.",
    metaTitle: "Access Control Systems — LodgeCore Access",
    metaDesc: "LodgeCore supplies and installs access controllers, RFID readers, magnetic locks and electric strikes for hotels, offices and commercial buildings.",
    features: [
      "Access controllers for multi-door management",
      "RFID and contactless card readers",
      "Electric strikes, magnetic locks and mortise bolts",
      "Exit buttons and request-to-exit hardware",
      "Door sensors and open/close status monitoring",
      "Visitor management and intercom integration",
      "Time-based access scheduling and zoning",
      "Multi-zone access control and hierarchy",
      "Emergency override and lockdown capability",
      "Integration with CCTV and security systems",
    ],
    related: [
      { href: "/access/hotel-locks", label: "Hotel Locks" },
      { href: "/hardware/access-control", label: "Hardware" },
      { href: "/solutions/offices", label: "Offices Solution" },
    ],
  },
  encoders: {
    title: "Card Encoders",
    desc: "RFID and MIFARE key card encoding systems for hotel front desks. Issue, duplicate and cancel key cards instantly.",
    metaTitle: "Hotel Card Encoders — LodgeCore Access",
    metaDesc: "RFID and MIFARE hotel card encoders for front desk key issuance. Compatible with LodgeCore PMS for automated check-in encoding.",
    features: [
      "RFID and MIFARE card encoding at the front desk",
      "Compatible with major hotel electronic lock brands",
      "Single and dual card encoding station options",
      "USB and network-connected encoder configurations",
      "Integrated with LodgeCore PMS for automatic encoding",
      "Card duplication, cancellation and re-encoding",
      "Staff and guest card level differentiation",
      "Encoding audit trail and activity log",
      "High-volume encoding capability for large properties",
      "Training and configuration by the LodgeCore team",
    ],
    related: [
      { href: "/access/hotel-locks", label: "Hotel Locks" },
      { href: "/access/programmers", label: "Lock Programmers" },
      { href: "/hospitality/pms", label: "PMS Integration" },
    ],
  },
  programmers: {
    title: "Lock Programmers",
    desc: "Handheld and USB lock programming devices for configuring, initialising and maintaining electronic lock systems.",
    metaTitle: "Hotel Lock Programmers — LodgeCore Access",
    metaDesc: "Lock programming devices for configuring and maintaining hotel electronic lock systems. Supplied and supported by LodgeCore.",
    features: [
      "Handheld programmers for on-site lock configuration",
      "USB programmers for computer-based management",
      "Lock initialisation and factory reset capability",
      "Access level programming and configuration",
      "Audit log extraction from lock memory",
      "Battery status and lock diagnostics",
      "Compatible with major hotel electronic lock systems",
      "Training on programmer operation by LodgeCore",
      "Replacement programmer supply and ongoing support",
    ],
    related: [
      { href: "/access/encoders", label: "Card Encoders" },
      { href: "/access/hotel-locks", label: "Hotel Locks" },
      { href: "/services/maintenance", label: "Maintenance" },
    ],
  },
  "door-hardware": {
    title: "Door Hardware",
    desc: "Door handles, lock bodies, cylinders, door closers and mechanical hardware to complete your access installation.",
    metaTitle: "Door Hardware — LodgeCore Access",
    metaDesc: "Hotel and commercial door hardware including handles, lock bodies, cylinders, closers and mechanical components supplied by LodgeCore.",
    features: [
      "Door handles and lever sets in multiple finishes",
      "Mechanical and electronic mortise lock bodies",
      "Euro profile cylinders and smart cylinders",
      "Door closers for controlled and compliant closure",
      "Fire-rated door hardware options",
      "ADA and accessibility-compliant hardware",
      "Escutcheons, back plates and trim sets",
      "Anti-ligature hardware for secure environments",
      "Corrosion-resistant options for coastal climates",
    ],
    related: [
      { href: "/access/hotel-locks", label: "Hotel Locks" },
      { href: "/access/access-control", label: "Access Control" },
      { href: "/services/installation", label: "Installation" },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return { title: page?.metaTitle ?? "LodgeCore Access", description: page?.metaDesc ?? "" };
}

export default async function AccessSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) {
    return (
      <PublicShell eyebrow="LodgeCore Access" title="Coming Soon" description="This page is being prepared. Contact us to learn more.">
        <section className="section-gap">
          <div className="contain" style={{ textAlign: "center" }}>
            <Link href="/access" className="btn btn-outline">← Back to Access</Link>
          </div>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell eyebrow="LodgeCore Access" title={page.title} description={page.desc}>
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
                <div className="portal-card-title">Request a quote</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7 }}>
                  Talk to the LodgeCore Access team about hardware supply, installation and integration for your property.
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
          <h2 className="cta-title">Ready to Upgrade Your Property Access?</h2>
          <p className="cta-body">Talk to the LodgeCore team about hardware, installation and integration.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Request a quote →</Link>
            <Link href="/access" className="btn btn-outline btn-lg">All access products</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

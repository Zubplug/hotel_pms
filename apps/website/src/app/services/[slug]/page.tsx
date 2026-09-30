import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";
import Link from "next/link";

const PAGES: Record<string, {
  title: string; desc: string; metaTitle: string; metaDesc: string;
  features: string[]; related: { href: string; label: string }[];
  cta: string;
}> = {
  installation: {
    title: "Installation",
    desc: "Professional on-site installation of all hardware — electronic locks, access control, smart systems, cameras and networking — by trained LodgeCore technicians.",
    metaTitle: "Property Technology Installation — LodgeCore Systems",
    metaDesc: "LodgeCore Systems provides professional on-site installation of electronic locks, access control, smart room systems and networking for all property types.",
    cta: "Request Installation",
    features: [
      "Site survey and pre-installation planning",
      "Professional installation of electronic locks and access hardware",
      "Smart room technology and sensor installation",
      "CCTV, intercom and security system installation",
      "Network infrastructure installation and cable management",
      "System testing and commissioning post-installation",
      "Handover documentation and as-built records",
      "Staff orientation on installed systems",
      "Follow-up inspection and sign-off",
      "Integration with LodgeCore Care for ongoing maintenance",
    ],
    related: [
      { href: "/services/integration", label: "Integration Services" },
      { href: "/services/deployment", label: "Full Deployment" },
      { href: "/hardware", label: "Hardware Catalogue" },
    ],
  },
  integration: {
    title: "System Integration",
    desc: "Connecting PMS, POS, access control, smart systems and third-party platforms through APIs, middleware and custom integration development.",
    metaTitle: "System Integration — LodgeCore Systems",
    metaDesc: "LodgeCore Systems connects PMS, POS, access control, smart rooms and third-party platforms through API and system integration.",
    cta: "Talk to an Integration Specialist",
    features: [
      "PMS to access control integration (key card automation)",
      "PMS to smart room integration (check-in activation)",
      "POS to PMS folio integration",
      "Third-party system integration via API",
      "Custom middleware development where required",
      "OTA and channel manager connectivity",
      "Payment gateway integration",
      "Building management system (BMS) integration",
      "IoT device and sensor integration",
      "Integration testing and validation documentation",
    ],
    related: [
      { href: "/services/installation", label: "Installation" },
      { href: "/integrations", label: "Integration Catalogue" },
      { href: "/services/deployment", label: "Full Deployment" },
    ],
  },
  deployment: {
    title: "Full Deployment",
    desc: "End-to-end property technology deployment — from initial consultation and specification through hardware supply, installation, integration, training and handover.",
    metaTitle: "Property Technology Deployment — LodgeCore Systems",
    metaDesc: "LodgeCore Systems manages the complete deployment of property technology from specification and supply through to installation, integration and training.",
    cta: "Request a Deployment Plan",
    features: [
      "Initial property audit and technology requirement mapping",
      "Hardware and software specification and recommendation",
      "Project planning, timeline and milestone management",
      "Hardware procurement and delivery coordination",
      "On-site installation of all hardware and systems",
      "Software configuration and system setup",
      "Integration of all connected systems",
      "Data migration from legacy systems where applicable",
      "Comprehensive staff training programme",
      "Handover, acceptance testing and go-live support",
    ],
    related: [
      { href: "/services/installation", label: "Installation" },
      { href: "/services/integration", label: "Integration" },
      { href: "/services/support", label: "Ongoing Support" },
    ],
  },
  maintenance: {
    title: "Preventive Maintenance",
    desc: "Scheduled maintenance visits, system health checks and hardware servicing to keep your property technology operating at peak performance.",
    metaTitle: "Property Technology Maintenance — LodgeCore Care",
    metaDesc: "LodgeCore Care provides preventive maintenance, system health checks and hardware servicing for all installed technology systems.",
    cta: "Get a Maintenance Contract",
    features: [
      "Scheduled preventive maintenance visits",
      "Electronic lock inspection, testing and lubrication",
      "Access control system health check",
      "Smart system sensor and device calibration",
      "Software and firmware update management",
      "Battery replacement and hardware servicing",
      "Security camera and NVR maintenance",
      "Network infrastructure maintenance and review",
      "Maintenance logs and service records",
      "Priority emergency callout for maintenance contract holders",
    ],
    related: [
      { href: "/care", label: "LodgeCore Care" },
      { href: "/services/support", label: "Technical Support" },
      { href: "/services/deployment", label: "Initial Deployment" },
    ],
  },
  support: {
    title: "Technical Support",
    desc: "Remote and on-site technical support from the LodgeCore Care team for all software, hardware and integrated systems.",
    metaTitle: "Technical Support — LodgeCore Care",
    metaDesc: "LodgeCore Care provides remote and on-site technical support for LodgeCore software, electronic locks, access control and smart systems.",
    cta: "Get Support",
    features: [
      "Remote helpdesk support for all LodgeCore software",
      "Remote diagnostics for hardware and access systems",
      "On-site technical visits for complex issues",
      "System troubleshooting and fault resolution",
      "Lock and access control emergency support",
      "Software configuration assistance",
      "Staff training and knowledge refreshers",
      "Escalation path for critical system failures",
      "SLA-backed response times for contract holders",
      "Support portal and ticketing for tracking all requests",
    ],
    related: [
      { href: "/care", label: "LodgeCore Care Plans" },
      { href: "/services/maintenance", label: "Maintenance" },
      { href: "/portal/support", label: "Customer Portal — Support" },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  return { title: page?.metaTitle ?? "LodgeCore Services", description: page?.metaDesc ?? "" };
}

export default async function ServiceSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) {
    return (
      <PublicShell eyebrow="Services" title="Coming Soon" description="This service page is being prepared.">
        <section className="section-gap">
          <div className="contain" style={{ textAlign: "center" }}>
            <Link href="/services" className="btn btn-outline">← All services</Link>
          </div>
        </section>
      </PublicShell>
    );
  }
  return (
    <PublicShell eyebrow="LodgeCore Services" title={page.title} description={page.desc}>
      <section className="section-gap">
        <div className="contain">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
            <div>
              <div className="section-kicker">What&apos;s Included</div>
              <h2 className="section-title" style={{ fontSize: "1.8rem", marginBottom: 28 }}>Service Scope.</h2>
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
                <div className="portal-card-title">{page.cta}</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7 }}>
                  Talk to the LodgeCore Systems team about {page.title.toLowerCase()} for your property.
                </p>
                <Link href="/book-demo" className="btn btn-primary" style={{ border: "none", display: "block", textAlign: "center" }}>{page.cta} →</Link>
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
          <h2 className="cta-title">Ready to Get Started?</h2>
          <p className="cta-body">Talk to the LodgeCore team about {page.title.toLowerCase()} for your property.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">{page.cta} →</Link>
            <Link href="/services" className="btn btn-outline btn-lg">All services</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

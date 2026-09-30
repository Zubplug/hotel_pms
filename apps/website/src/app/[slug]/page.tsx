import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

const pages: Record<
  string,
  { eyebrow: string; title: string; description: string; body: string }
> = {
  security: {
    eyebrow: "Security",
    title: "Built to protect\nyour operation.",
    description:
      "LodgeCore is designed with security at every layer — from encrypted data in transit, to role-based access control, to immutable audit logs across all operational workflows.",
    body: "LodgeCore uses industry-standard encryption (TLS 1.3 for data in transit, AES-256 for data at rest), role-based access control across every workspace, and detailed audit logging for all sensitive operations. Our architecture is aligned with SOC 2 Type II requirements and we undergo regular penetration testing by independent security firms.",
  },
  privacy: {
    eyebrow: "Privacy policy",
    title: "Your data,\nyour operation.",
    description:
      "LodgeCore collects and uses data only to deliver and improve the platform. We do not sell personal data or use it for advertising.",
    body: "This policy describes how LodgeCore collects, stores and processes personal data on behalf of hotel properties and their guests. As a data processor, we follow your instructions as the data controller and maintain appropriate technical and organisational measures to protect data integrity and confidentiality. Full policy documentation is available to LodgeCore customers through the control plane.",
  },
  terms: {
    eyebrow: "Terms of service",
    title: "Terms that are\nfair to both sides.",
    description:
      "The terms that govern use of LodgeCore services — written to be readable, not just legally defensible.",
    body: "By using LodgeCore, you agree to these terms. They cover account responsibilities, permitted use, data handling, service availability, payment obligations, and what happens if either party needs to end the relationship. Full terms are provided during onboarding and available at any time through the customer portal.",
  },
  sla: {
    eyebrow: "Service level agreement",
    title: "Operational\ncommitments.",
    description:
      "Our commitments on availability, support response times and what happens when things don't go as planned.",
    body: "LodgeCore targets 99.5% uptime for all production workspaces. We publish live service status and notify customers proactively when incidents affect their property. Support response times are defined by plan tier — see your account agreement for the specific commitments applicable to your property.",
  },
  status: {
    eyebrow: "System status",
    title: "Platform\nhealth.",
    description:
      "Current availability and operational status across all LodgeCore services.",
    body: "All LodgeCore services are monitored continuously. This page reflects current service health. For real-time status updates and incident history, customers can subscribe to status notifications through the customer portal.",
  },
  about: {
    eyebrow: "About LodgeCore",
    title: "Property Technology\nthat connects everything.",
    description:
      "LodgeCore is a Property Technology Platform connecting hospitality software, electronic access, smart rooms, hardware deployment and managed support in one integrated ecosystem.",
    body: "LodgeCore was built by a team with direct experience in hotel operations and property technology. We started from a simple observation: the digital and physical infrastructure of modern properties — software, locks, smart devices, access control — are almost never connected. LodgeCore is our answer. A platform that connects the software running the business with the physical systems guests and residents interact with every day. From the hotel PMS and POS to the electronic lock on the guestroom door, from the smart room energy switch to the access controller at the building entrance — LodgeCore brings them together under one ecosystem, deployed and supported by our team.",
  },
  partners: {
    eyebrow: "Partners",
    title: "Technology &\nintegration partners.",
    description:
      "LodgeCore works with technology vendors, system integrators, property developers and installation contractors to deliver the best outcomes for properties.",
    body: "LodgeCore maintains relationships with hardware vendors, access control manufacturers, smart technology suppliers, systems integrators, property developers and installation contractors. If you are a technology company, consultant, property developer or contractor interested in working with LodgeCore, contact the partnerships team. We are building the technology layer behind modern properties and we are looking for the right partners to help us do that.",
  },
  careers: {
    eyebrow: "Careers",
    title: "Help us build\nproperty technology.",
    description:
      "We're building the technology platform that connects modern properties. If you care about property, technology and great products, we'd like to talk.",
    body: "LodgeCore is building a category-defining property technology platform — connecting software, access control, smart rooms and hardware deployment for hotels, homes and commercial properties. We value operational thinking, product craft, technical depth and people who genuinely understand the environments our technology runs in. Current openings are available through the LodgeCore team — reach out through our contact page.",
  },
  contact: {
    eyebrow: "Contact LodgeCore",
    title: "Let's talk about\nyour property.",
    description:
      "Whether you need hospitality software, access hardware, smart technology or a full deployment — the LodgeCore team is available to help.",
    body: "The fastest way to reach the right person at LodgeCore is through the demo request form. Tell us about your property type, size and what you need — we'll route your message to the appropriate team: Hospitality, Access, Smart, Systems or Care. Existing customers can reach support directly through the customer portal at portal.lodgecore.com.",
  },
};

const fallback = {
  eyebrow: "LodgeCore",
  title: "Connected hotel\noperations.",
  description: "One connected platform for every team, every guest, every stay.",
  body: "This page is part of the LodgeCore platform and will contain the relevant policy, documentation or service information for this area. For questions, contact the LodgeCore team.",
};

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const page = pages[slug] || fallback;

  return (
    <main className="site-shell">
      <PublicHeader />

      {/* Hero */}
      <section className="page-hero" style={{ paddingTop: 130 }}>
        <div className="page-hero-bg" />
        <div className="contain">
          <div className="section-kicker">{page.eyebrow}</div>
          <h1 style={{ whiteSpace: "pre-line" }}>{page.title}</h1>
          <p>{page.description}</p>
        </div>
      </section>

      {/* Content */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ maxWidth: 760 }}>
            <div
              style={{
                padding: "32px 36px",
                border: "1px solid var(--border-card)",
                borderRadius: "var(--radius-xl)",
                background: "var(--bg-card)",
                fontSize: 15,
                lineHeight: 1.8,
                color: "var(--text-secondary)",
              }}
            >
              {page.body}
            </div>
          </div>

          {/* CTA */}
          <div style={{ marginTop: 48, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href="/book-demo" className="btn btn-primary">
              Talk to the team →
            </Link>
            <Link href="/" className="btn btn-outline">
              Back to LodgeCore
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

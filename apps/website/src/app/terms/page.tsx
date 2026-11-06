import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "The terms governing access to and use of LodgeCore services.",
  alternates: { canonical: "https://getlodgecore.vercel.app/terms" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "4 November 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 42 }}>
      <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-.04em", marginBottom: 12 }}>{title}</h2>
      <div style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul style={{ margin: "12px 0 0", paddingLeft: 22, display: "grid", gap: 8, listStyle: "disc" }}>{children}</ul>;
}

export default function TermsPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      <section className="page-hero" style={{ paddingTop: 132, paddingBottom: 70 }}>
        <div className="page-hero-bg" />
        <div className="contain">
          <div className="section-kicker">Legal · LodgeCore</div>
          <h1 style={{ maxWidth: 760 }}>Terms that keep the operation clear.</h1>
          <p style={{ maxWidth: 700 }}>These Terms and Conditions govern access to and use of LodgeCore hospitality management software and related services.</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 18 }}>Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="section-gap">
        <div className="contain">
          <article style={{ maxWidth: 900, padding: "34px 30px", border: "1px solid var(--border-card)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)" }}>
            <div style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", padding: "16px 18px", background: "var(--accent-dim)", color: "var(--text-primary)", fontSize: 14, lineHeight: 1.7 }}>
              By creating an account, accepting these Terms, or using LodgeCore, you confirm that you have read and accepted these Terms. If you do not agree, do not use the Service.
            </div>

            <Section title="1. Definitions"><p><strong>“LodgeCore,” “we,” “us,”</strong> or <strong>“our”</strong> means ZUBPLUG DIGITAL INTEGRATED SERVICES LIMITED. <strong>“You”</strong> or <strong>“Customer”</strong> means the individual, hotel, lodge, company, or organisation using the Service. <strong>“Service”</strong> means the LodgeCore website, web application, mobile applications, APIs, software, and related services. <strong>“Authorised User”</strong> means a person you permit to access the Service. <strong>“Customer Data”</strong> means information submitted to or stored in the Service by you or your Authorised Users.</p></Section>

            <Section title="2. Acceptance and eligibility"><p>These Terms form a binding agreement between you and LodgeCore. If you accept them for an organisation, you confirm that you have authority to bind that organisation. You must provide accurate, complete, and current information and must comply with all laws applicable to your use of the Service.</p></Section>

            <Section title="3. The LodgeCore Service"><p>LodgeCore provides hospitality management tools that may include property and room management, reservations, guest records, front-desk and housekeeping workflows, point-of-sale, invoicing, payments, inventory, corporate bookings, reporting, approvals, mobile management, notifications, and integrations. Features depend on your plan, configuration, permissions, location, and technical availability. We may improve, modify, replace, or discontinue features and will use reasonable efforts to avoid materially reducing core functionality.</p></Section>

            <Section title="4. Accounts and Authorised Users"><p>You are responsible for protecting login credentials, controlling Authorised User access, assigning appropriate permissions, and all activity performed through your account. Do not share individual credentials where separate accounts are available. Notify us promptly at <a href="mailto:support@getlodgecore.com" style={{ color: "var(--accent)", textDecoration: "underline" }}>support@getlodgecore.com</a> if you suspect unauthorised access. We may suspend an account that is compromised, misused, or used in breach of these Terms.</p></Section>

            <Section title="5. Customer responsibilities"><p>You are responsible for your use of the Service and for complying with applicable laws, regulations, licences, tax requirements, employment obligations, and hospitality standards. You must not use LodgeCore to:</p><List><li>commit fraud, money laundering, or another unlawful activity;</li><li>transmit malware or interfere with the security or availability of the Service;</li><li>access another user’s account or bypass usage limits and security controls;</li><li>scrape, reverse engineer, copy, resell, or create derivative works from the Service; or</li><li>upload content that infringes another person’s rights or that you do not have permission to use.</li></List><p style={{ marginTop: 12 }}>You are responsible for obtaining required guest consents, notices, licences, permissions, and approvals relating to your business.</p></Section>

            <Section title="6. Reservations and property operations"><p>LodgeCore is a management platform. Unless expressly stated otherwise, we do not own, operate, manage, or control properties, rooms, facilities, venues, restaurants, or services managed through the Service. You remain responsible for room availability, rates, reservations, guest information, check-in decisions, property safety, service quality, deposits, refunds, cancellation charges, taxes, and disputes with guests or other third parties.</p></Section>

            <Section title="7. Fees, payments, and taxes"><p>Some features require subscription fees, transaction fees, implementation fees, usage charges, or other charges communicated before purchase. Fees are payable according to the applicable invoice or payment schedule and are non-refundable except where required by law or expressly agreed in writing. You are responsible for applicable taxes, bank charges, and payment-provider charges. Failed or overdue payments may result in restricted or suspended access.</p><p style={{ marginTop: 12 }}>You are responsible for verifying payments, refunds, reversals, taxes, discounts, deposits, and guest balances before relying on them for business or accounting purposes. Payment transactions may be processed by third-party providers and may be subject to their own terms and privacy policies.</p></Section>

            <Section title="8. Customer Data and privacy"><p>You retain ownership of Customer Data. You grant LodgeCore a limited licence to host, copy, process, transmit, and use Customer Data as reasonably necessary to provide, secure, support, and improve the Service; process requested integrations; prevent fraud; comply with law; and produce aggregated or anonymised analytics.</p><p style={{ marginTop: 12 }}>You are responsible for collecting and using Customer Data lawfully and for having all permissions required to provide it to LodgeCore. Our handling of personal data is described in our <Link href="/privacy" style={{ color: "var(--accent)", textDecoration: "underline" }}>Privacy Policy</Link>. You are responsible for giving guests, employees, and other individuals any required privacy notices.</p></Section>

            <Section title="9. Security and availability"><p>We use reasonable administrative, technical, and organisational safeguards designed to protect the Service and Customer Data. However, no online service is completely secure or continuously available. Internet connections, devices, third-party systems, maintenance, outages, and events beyond our control may affect availability. You are responsible for secure devices, passwords, networks, and independent backups of critical records.</p></Section>

            <Section title="10. Third-party services and integrations"><p>The Service may connect to payment processors, messaging providers, accounting systems, booking channels, cloud infrastructure, email providers, app stores, and other third-party services. Those services are governed by their own terms. We are not responsible for their availability, security, accuracy, fees, changes, or failures. You authorise LodgeCore to exchange information with integrations that you enable or request.</p></Section>

            <Section title="11. Intellectual property"><p>LodgeCore and its licensors own all rights in the Service, including its software, design, branding, documentation, workflows, interfaces, trademarks, and improvements. We grant you a limited, non-exclusive, non-transferable right to use the Service during your applicable subscription. You must not copy, resell, sublicense, reverse engineer, scrape, or commercially exploit the Service, or remove proprietary notices.</p></Section>

            <Section title="12. Confidentiality"><p>Each party must protect confidential information received from the other party and use it only to perform or exercise rights under these Terms. This obligation does not apply to information that is public, already lawfully known, independently developed, lawfully received from another source, or required to be disclosed by law.</p></Section>

            <Section title="13. Suspension and termination"><p>You may stop using the Service at any time. We may suspend or terminate access if you materially breach these Terms, fail to pay applicable fees, create a security or legal risk, use the Service unlawfully, or if required by law. Where reasonable, we will provide notice and an opportunity to remedy the breach. After termination, your access ends and, subject to legal retention obligations, Customer Data may be deleted after a reasonable retention period. Export data you need before termination.</p></Section>

            <Section title="14. Disclaimers"><p>To the maximum extent permitted by law, the Service is provided “as available” and “as is.” We do not guarantee that it will be uninterrupted, error-free, compatible with every device or integration, or produce complete accounting, tax, financial, operational, or management results. LodgeCore does not provide legal, accounting, tax, audit, financial, employment, health, safety, or other professional advice.</p></Section>

            <Section title="15. Limitation of liability"><p>To the maximum extent permitted by law, LodgeCore and its directors, officers, employees, contractors, affiliates, and service providers will not be liable for lost profits, revenue, bookings, goodwill, business opportunities, data, business interruption, or indirect, incidental, special, exemplary, or consequential loss. Our total liability relating to the Service will not exceed the fees paid or payable by you for the three months immediately preceding the event giving rise to the claim. Nothing excludes liability that cannot legally be excluded.</p></Section>

            <Section title="16. Indemnity"><p>You agree to defend, indemnify, and hold harmless LodgeCore and its directors, officers, employees, contractors, affiliates, and service providers from claims, losses, damages, costs, and expenses arising from your use or misuse of the Service, breach of these Terms, Customer Data, violation of law or another person’s rights, or disputes relating to your property, guests, employees, suppliers, or booking partners.</p></Section>

            <Section title="17. Changes to these Terms"><p>We may update these Terms by posting an updated version with a revised effective date. If a change materially affects your rights or obligations, we will use reasonable efforts to provide notice. Continued use of the Service after the effective date means that you accept the updated Terms.</p></Section>

            <Section title="18. Governing law and disputes"><p>These Terms are governed by the laws of the Federal Republic of Nigeria. The parties will first attempt in good faith to resolve disputes through written notice and discussions between authorised representatives. If a dispute cannot be resolved amicably, it may be submitted to a court of competent jurisdiction in Nigeria, subject to any mandatory rights available under applicable law.</p></Section>

            <Section title="19. General"><p>If any provision is invalid or unenforceable, the remaining provisions remain in effect. Failure to enforce a provision is not a waiver. You may not transfer these Terms without our written consent; we may assign them as part of a merger, restructuring, sale of assets, or transfer of the Service. These Terms constitute the entire agreement concerning the Service.</p></Section>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 46, paddingTop: 22, display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "space-between", fontSize: 13 }}><Link href="/privacy" style={{ color: "var(--accent)" }}>Privacy policy →</Link><Link href="/book-demo" style={{ color: "var(--accent)" }}>Contact LodgeCore →</Link></div>
          </article>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

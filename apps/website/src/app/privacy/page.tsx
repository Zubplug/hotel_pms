import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "The LodgeCore Management mobile application privacy policy.",
  alternates: { canonical: "https://getlodgecore.vercel.app/privacy" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "3 November 2026";

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 42 }}>
      <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-.04em", marginBottom: 12 }}>{title}</h2>
      <div style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul style={{ margin: "12px 0 0", paddingLeft: 22, display: "grid", gap: 8 }}>{children}</ul>;
}

export default function PrivacyPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      <section className="page-hero" style={{ paddingTop: 132, paddingBottom: 70 }}>
        <div className="page-hero-bg" />
        <div className="contain">
          <div className="section-kicker">Legal · LodgeCore Management</div>
          <h1 style={{ maxWidth: 760 }}>Privacy that respects the operation.</h1>
          <p style={{ maxWidth: 680 }}>This policy explains how LodgeCore handles information in the LodgeCore Management mobile application and related services.</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 18 }}>Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="section-gap">
        <div className="contain">
          <article style={{ maxWidth: 820, padding: "34px 30px", border: "1px solid var(--border-card)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.8, margin: 0 }}>
              LodgeCore (“LodgeCore”, “we”, “us”, or “our”) provides property-management and operational software for hotels and other properties. This Privacy Policy applies specifically to the <strong style={{ color: "var(--text-primary)" }}>LodgeCore Management</strong> Android and mobile applications, the LodgeCore web services they connect to, and related support services.
            </p>

            <PolicySection title="1. Who is responsible for your information?"><p>For LodgeCore account, application, security, and support data, LodgeCore is responsible for the processing described in this policy. When a hotel, resort, or other property uses LodgeCore to manage its guests, employees, reservations, folios, rooms, or operations, that property may be the data controller and LodgeCore may act as its service provider or data processor. The property’s own privacy notices and instructions may also apply.</p></PolicySection>

            <PolicySection title="2. Information we collect"><p>Depending on how the application is used, we may process:</p><List><li><strong>Account information:</strong> name, work email, phone number, staff ID, job role, property access, authentication records, and account preferences.</li><li><strong>Property and operational information:</strong> property configuration, room status, reservations, guest profiles, folios, payments, inventory, housekeeping, point-of-sale, audit, approval, and other records entered by an authorised property user.</li><li><strong>Device and technical information:</strong> device model, operating-system version, app version, language, time zone, IP address, connectivity state, diagnostic information, and security or session identifiers.</li><li><strong>Offline and synchronisation information:</strong> locally queued operations, identifiers, timestamps, conflict information, and the minimum records needed to keep authorised workflows available offline and reconcile them when connectivity returns.</li><li><strong>Push-notification information:</strong> a device notification token and notification preferences where you grant notification permission.</li><li><strong>Support information:</strong> messages, attachments, and contact details you provide when requesting help.</li></List></PolicySection>

            <PolicySection title="3. Information we do not collect through the mobile app"><p>The application does not request or store your device password. Biometric sign-in, where enabled, is handled by the operating system; LodgeCore receives a success or failure result and does not receive your fingerprint or face data. We do not use the app to collect precise location, contacts, microphone recordings, or advertising identifiers unless a future feature clearly requests permission and explains its purpose before collection.</p></PolicySection>

            <PolicySection title="4. How we use information"><List><li>To authenticate users and enforce property, role, and permission boundaries.</li><li>To provide reservations, room operations, point-of-sale, finance, housekeeping, inventory, reporting, audit, and management features.</li><li>To synchronise authorised offline work and detect or resolve duplicate, stale, or conflicting operations.</li><li>To send security, workflow, operational, and service notifications that users or their property have enabled.</li><li>To provide support, maintain reliability, investigate errors, prevent fraud or misuse, and protect LodgeCore and its customers.</li><li>To meet legal, regulatory, accounting, security, and contractual obligations.</li><li>To improve the service using aggregated or de-identified information where practical.</li></List></PolicySection>

            <PolicySection title="5. Legal bases"><p>Where applicable, we process information to perform a contract, provide the service requested by a property or user, comply with legal obligations, protect legitimate interests such as security and service reliability, or with consent where consent is required. A property may determine the appropriate legal basis for guest and employee records entered into its LodgeCore workspace.</p></PolicySection>

            <PolicySection title="6. When we share information"><p>We do not sell personal information and we do not use LodgeCore Management for third-party behavioural advertising. We may disclose information only as needed to:</p><List><li>the property, organisation, and authorised staff who administer the relevant LodgeCore workspace;</li><li>hosting, database, authentication, email, push-notification, storage, security, and technical-support providers that process information on our instructions;</li><li>payment, access-control, hardware, booking, or other integrations enabled by the property or user;</li><li>professional advisers, auditors, or insurers subject to confidentiality obligations; and</li><li>law-enforcement, regulatory, or governmental authorities where legally required or necessary to protect rights, safety, or the service.</li></List><p style={{ marginTop: 12 }}>Service providers may process information in countries other than where you live. We use contractual, organisational, and technical safeguards appropriate to the transfer and the information involved.</p></PolicySection>

            <PolicySection title="7. Offline storage and security"><p>The app may retain encrypted or access-controlled operational data and queued actions on an authorised device so essential workflows can continue without a network connection. Offline data is synchronised with the relevant LodgeCore workspace when connectivity returns. Sign out, device security, application updates, and removal of an authorised device may affect local availability. We use HTTPS/TLS in transit, access controls, audit records, credential protections, and other reasonable safeguards; no internet or mobile system can be guaranteed completely secure.</p></PolicySection>

            <PolicySection title="8. Retention"><p>We retain information for as long as needed to provide the service, maintain auditability, resolve disputes, meet legal and financial obligations, enforce agreements, and protect the service. Property records may be retained according to the property’s contract and documented retention settings. Local offline copies are removed or become inaccessible when they are synchronised, expired, cleared by the app, or removed from the device, subject to technical backups and security logs.</p></PolicySection>

            <PolicySection title="9. Your choices and rights"><p>Subject to applicable law and the property’s role as controller, you may request access, correction, deletion, restriction, portability, or objection to certain processing. You may withdraw optional notification permission in your device settings and may contact the property that manages your account about guest or employee records. Some information must be retained to provide the service, preserve financial or audit records, or comply with law.</p><p style={{ marginTop: 12 }}>To request deletion of a LodgeCore Management account, use our <Link href="/privacy/delete" style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 700 }}>account deletion request page</Link> or email <a href="mailto:privacy@getlodgecore.com" style={{ color: "var(--accent)", textDecoration: "underline" }}>privacy@getlodgecore.com</a>. We may verify your identity and ask which property or account your request concerns.</p></PolicySection>

            <PolicySection title="10. Children"><p>LodgeCore Management is a business application and is not directed to children. We do not knowingly collect personal information directly from children through the app. If you believe a child’s information has been submitted, please contact us so we can investigate and take appropriate action.</p></PolicySection>

            <PolicySection title="11. Changes to this policy"><p>We may update this policy when the app, services, legal requirements, or data practices change. The current version will remain available at this URL with its updated date. Where required, we will provide additional notice through the app, a customer workspace, or another appropriate channel.</p></PolicySection>

            <PolicySection title="12. Contact LodgeCore"><address style={{ fontStyle: "normal", lineHeight: 1.9 }}><strong style={{ color: "var(--text-primary)" }}>LodgeCore</strong><br />Privacy and Data Protection<br /><a href="mailto:privacy@getlodgecore.com" style={{ color: "var(--accent)", textDecoration: "underline" }}>privacy@getlodgecore.com</a><br /><a href="https://getlodgecore.vercel.app" style={{ color: "var(--accent)", textDecoration: "underline" }}>getlodgecore.vercel.app</a></address></PolicySection>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 46, paddingTop: 22, display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "space-between", fontSize: 13 }}><Link href="/terms" style={{ color: "var(--accent)" }}>Terms of service →</Link><Link href="/book-demo" style={{ color: "var(--accent)" }}>Contact LodgeCore →</Link></div>
          </article>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}

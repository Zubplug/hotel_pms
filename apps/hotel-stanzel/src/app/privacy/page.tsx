import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Read the Stanzel Grand Resort privacy policy. We are committed to protecting your personal data in line with Nigerian data protection law and international best practice.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = '10 October 2025';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--space-10)' }}>
      <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', color: 'var(--color-green)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.85, color: 'var(--text-body)' }}>
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="main-content">

        {/* Hero band */}
        <div style={{
          background: 'var(--color-green)',
          paddingTop: 'calc(var(--nav-height) + var(--space-12))',
          paddingBottom: 'var(--space-12)',
        }}>
          <div className="container">
            <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-3)' }}>Legal</p>
            <h1 style={{ color: 'var(--color-ivory)' }}>Privacy Policy</h1>
            <p style={{ color: 'rgba(250,248,244,0.65)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="section">
          <div className="container" style={{ maxWidth: '780px' }}>

            <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.85, marginBottom: 'var(--space-10)', color: 'var(--text-body)' }}>
              Stanzel Grand Resort ("<strong>we</strong>", "<strong>us</strong>", or "<strong>the Resort</strong>") is committed to protecting and respecting your privacy.
              This policy explains how we collect, use, store and share personal information when you visit our website, make a reservation, or otherwise interact with us.
              Please read it carefully before providing us with any personal data.
            </p>

            <Section title="1. Who We Are">
              <p>
                Stanzel Grand Resort is a luxury hospitality property located at Plot C103, A Close, off 1st Avenue, Gwarinpa Estate, Abuja, Federal Capital Territory, Nigeria.
                We operate this website and manage all reservations and guest communications. For privacy enquiries, contact us at{' '}
                <a href="mailto:info@stanzelgrandresort.com" style={{ color: 'var(--color-green)', textDecoration: 'underline' }}>
                  info@stanzelgrandresort.com
                </a>.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p style={{ marginBottom: 'var(--space-4)' }}>We collect the following categories of personal information:</p>
              <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li><strong>Booking information:</strong> Name, email address, phone number, check-in and check-out dates, room type, number of guests, and special requests.</li>
                <li><strong>Payment information:</strong> Transaction reference and payment status. We do not store full card details — payments are processed by our secure payment provider (Paystack).</li>
                <li><strong>Contact and enquiry information:</strong> Any details you submit via our contact form, including your message, phone number, and enquiry type.</li>
                <li><strong>Technical data:</strong> IP address, browser type, device type, pages visited, and time spent — collected automatically via cookies and server logs.</li>
                <li><strong>Communications:</strong> Records of emails and messages you send us, including any preferences or feedback you share.</li>
              </ul>
            </Section>

            <Section title="3. How We Use Your Information">
              <p style={{ marginBottom: 'var(--space-4)' }}>We use your personal data for the following purposes:</p>
              <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li>To process, confirm and manage your reservation.</li>
                <li>To communicate with you before, during and after your stay.</li>
                <li>To process payments and issue receipts or invoices.</li>
                <li>To respond to enquiries, complaints and feedback.</li>
                <li>To send you information about offers and packages (only where you have consented or where permitted by law).</li>
                <li>To improve our website, services and guest experience.</li>
                <li>To comply with legal obligations, including tax and financial reporting.</li>
              </ul>
            </Section>

            <Section title="4. Legal Basis for Processing">
              <p style={{ marginBottom: 'var(--space-4)' }}>
                We process your personal data on the following legal bases under the Nigeria Data Protection Act 2023 (NDPA) and applicable law:
              </p>
              <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li><strong>Contract performance:</strong> Processing necessary to fulfil your reservation and provide the services you have requested.</li>
                <li><strong>Legitimate interests:</strong> Improving our services, fraud prevention, and website analytics.</li>
                <li><strong>Consent:</strong> Where you have opted in to receive marketing communications.</li>
                <li><strong>Legal obligation:</strong> Where we are required to process data to comply with Nigerian law.</li>
              </ul>
            </Section>

            <Section title="5. Cookies">
              <p style={{ marginBottom: 'var(--space-4)' }}>
                Our website uses cookies — small text files stored on your device — to improve functionality and user experience. We use:
              </p>
              <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li><strong>Essential cookies:</strong> Required for the booking flow and session management (e.g. hold token, booking step state). Cannot be disabled.</li>
                <li><strong>Analytics cookies:</strong> Used to understand how visitors use our site. You may opt out of these.</li>
              </ul>
              <p style={{ marginTop: 'var(--space-4)' }}>
                You can control cookies through your browser settings. Disabling essential cookies may prevent the booking process from working correctly.
              </p>
            </Section>

            <Section title="6. Data Sharing">
              <p style={{ marginBottom: 'var(--space-4)' }}>
                We do not sell your personal data. We may share it with the following parties only where necessary:
              </p>
              <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li><strong>LodgeCore PMS:</strong> Our property management system provider, which processes reservation data on our behalf.</li>
                <li><strong>Paystack:</strong> Our payment gateway, which processes card transactions securely.</li>
                <li><strong>Email service providers:</strong> Used to deliver booking confirmations and enquiry replies.</li>
                <li><strong>Legal and regulatory authorities:</strong> Where required by Nigerian law or a court order.</li>
              </ul>
            </Section>

            <Section title="7. Data Retention">
              <p>
                We retain personal data for as long as necessary to fulfil the purposes described in this policy. Booking records are typically retained for seven (7) years to comply with financial and tax obligations.
                Marketing preferences and enquiry data are retained for two (2) years from your last interaction unless you request earlier deletion.
              </p>
            </Section>

            <Section title="8. Your Rights">
              <p style={{ marginBottom: 'var(--space-4)' }}>
                Under applicable data protection law, you have the right to:
              </p>
              <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li>Access the personal data we hold about you.</li>
                <li>Correct inaccurate or incomplete data.</li>
                <li>Request deletion of your data ("right to be forgotten"), subject to legal retention obligations.</li>
                <li>Object to or restrict certain types of processing.</li>
                <li>Withdraw consent to marketing communications at any time.</li>
                <li>Lodge a complaint with the Nigeria Data Protection Commission (NDPC) if you believe we have not handled your data lawfully.</li>
              </ul>
              <p style={{ marginTop: 'var(--space-4)' }}>
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:info@stanzelgrandresort.com" style={{ color: 'var(--color-green)', textDecoration: 'underline' }}>
                  info@stanzelgrandresort.com
                </a>. We will respond within 30 days.
              </p>
            </Section>

            <Section title="9. Security">
              <p>
                We take reasonable technical and organisational measures to protect your personal data against unauthorised access, loss, or misuse.
                Our booking flow uses HTTPS encryption. Payment data is processed exclusively by Paystack using PCI-DSS compliant infrastructure and is never stored on our servers.
              </p>
            </Section>

            <Section title="10. Third-Party Links">
              <p>
                Our website may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to read their own privacy policies.
              </p>
            </Section>

            <Section title="11. Changes to This Policy">
              <p>
                We may update this policy from time to time to reflect changes in our practices or applicable law. The updated version will be published on this page with a revised "Last updated" date.
                Your continued use of our website after any change constitutes acceptance of the updated policy.
              </p>
            </Section>

            <Section title="12. Contact Us">
              <p>
                For any questions, requests or concerns about this privacy policy or how we handle your data, please contact:
              </p>
              <address style={{ marginTop: 'var(--space-4)', fontStyle: 'normal', lineHeight: 2 }}>
                <strong>Stanzel Grand Resort</strong><br />
                Plot C103, A Close, off 1st Avenue<br />
                Gwarinpa Estate, Abuja, FCT, Nigeria<br />
                <a href="mailto:info@stanzelgrandresort.com" style={{ color: 'var(--color-green)', textDecoration: 'underline' }}>
                  info@stanzelgrandresort.com
                </a>
              </address>
            </Section>

            {/* Navigation */}
            <div style={{
              borderTop: '1px solid var(--border)', paddingTop: 'var(--space-8)', marginTop: 'var(--space-6)',
              display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Link href="/terms" style={{ color: 'var(--color-green)', fontSize: 'var(--text-sm)', textDecoration: 'underline' }}>
                View Terms &amp; Conditions →
              </Link>
              <Link href="/contact" className="btn btn-outline-dark btn-sm">Contact Us</Link>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </>
  );
}

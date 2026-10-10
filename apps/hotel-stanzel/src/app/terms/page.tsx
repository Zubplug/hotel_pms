import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Read the Stanzel Grand Resort terms and conditions governing reservations, payments, cancellations, and use of our website and facilities.',
  robots: { index: true, follow: true },
};

const LAST_UPDATED = '10 October 2025';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 'var(--space-10)' }}>
      <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)', color: 'var(--color-green)' }}>
        {title}
      </h2>
      <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.85, color: 'var(--text-body)' }}>
        {children}
      </div>
    </section>
  );
}

const TOC = [
  { id: 'reservations', label: '1. Reservations & Booking' },
  { id: 'payment', label: '2. Payment & Rates' },
  { id: 'cancellation', label: '3. Cancellation & Modification' },
  { id: 'checkin', label: '4. Check-in & Check-out' },
  { id: 'conduct', label: '5. Guest Conduct & Responsibilities' },
  { id: 'facilities', label: '6. Facilities & Services' },
  { id: 'liability', label: '7. Liability' },
  { id: 'website', label: '8. Website Use' },
  { id: 'ip', label: '9. Intellectual Property' },
  { id: 'governing', label: '10. Governing Law' },
  { id: 'contact', label: '11. Contact' },
];

export default function TermsPage() {
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
            <h1 style={{ color: 'var(--color-ivory)' }}>Terms &amp; Conditions</h1>
            <p style={{ color: 'rgba(250,248,244,0.65)', marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </div>

        {/* Content + sidebar layout */}
        <div className="section">
          <div className="container">
            <div className="terms-layout">

              {/* Table of contents — sticky sidebar on desktop */}
              <aside className="terms-toc">
                <div style={{
                  position: 'sticky', top: 'calc(var(--nav-height) + var(--space-6))',
                  background: 'var(--color-ivory-dark)',
                  borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)',
                  border: '1px solid var(--border)',
                }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                    Contents
                  </p>
                  <nav aria-label="Terms contents">
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {TOC.map(({ id, label }) => (
                        <li key={id}>
                          <a href={`#${id}`} style={{
                            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                            textDecoration: 'none', lineHeight: 1.5,
                            transition: 'color var(--duration-sm) var(--ease)',
                          }}
                            className="toc-link">
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </aside>

              {/* Main content */}
              <div>
                <p style={{ fontSize: 'var(--text-base)', lineHeight: 1.85, marginBottom: 'var(--space-10)', color: 'var(--text-body)' }}>
                  These Terms &amp; Conditions govern your use of the Stanzel Grand Resort website and all reservations, stays, and interactions with our property.
                  By making a reservation or using our website, you confirm that you have read, understood, and agreed to these terms.
                  If you do not agree, please do not make a reservation or use our website.
                </p>

                <Section id="reservations" title="1. Reservations & Booking">
                  <p style={{ marginBottom: 'var(--space-4)' }}>
                    All reservations are subject to availability and confirmation. A reservation is not confirmed until you receive a written confirmation from Stanzel Grand Resort with a confirmation number.
                  </p>
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li>You must be at least 18 years of age to make a reservation.</li>
                    <li>All guest information provided at booking must be accurate and complete.</li>
                    <li>We reserve the right to refuse or cancel any reservation at our discretion, including in cases of pricing errors, fraud suspicion, or non-compliance with these terms.</li>
                    <li>Group bookings of five (5) or more rooms may be subject to separate group booking terms. Please contact us directly.</li>
                  </ul>
                </Section>

                <Section id="payment" title="2. Payment & Rates">
                  <p style={{ marginBottom: 'var(--space-4)' }}>
                    Rates are quoted in Nigerian Naira (NGN) unless otherwise stated and are inclusive of applicable taxes and service charges unless explicitly noted.
                  </p>
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li>Payment is required to confirm your reservation. A deposit or full pre-payment may be required depending on the rate plan selected.</li>
                    <li>Payments are processed securely through Paystack. We do not store card details on our servers.</li>
                    <li>Rates are subject to change without notice until a reservation is confirmed. The rate displayed at time of booking is the rate you will be charged.</li>
                    <li>Any additional charges incurred during your stay (e.g. restaurant, bar, room service) are payable on check-out and may be settled in cash or by card.</li>
                    <li>In the event of a pricing error on our website, we reserve the right to contact you and offer the correct rate or cancel the reservation with a full refund.</li>
                  </ul>
                </Section>

                <Section id="cancellation" title="3. Cancellation & Modification">
                  <p style={{ marginBottom: 'var(--space-4)' }}>
                    Our cancellation policy varies depending on the rate plan you select at the time of booking. The specific policy applicable to your reservation will be clearly shown before you confirm payment.
                  </p>
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li><strong>Flexible rates:</strong> Cancellations made more than 48 hours before the scheduled check-in date will receive a full refund. Cancellations within 48 hours of check-in will be charged the equivalent of one (1) night's stay.</li>
                    <li><strong>Non-refundable rates:</strong> No refund is available for any cancellation or modification. These rates are offered at a discount in exchange for this condition.</li>
                    <li><strong>Modifications:</strong> Requests to modify a reservation are subject to availability and the applicable rate plan. We will endeavour to accommodate modifications where possible.</li>
                    <li>To cancel or modify a reservation, use the <Link href="/manage" style={{ color: 'var(--color-green)', textDecoration: 'underline' }}>Manage Booking</Link> page or contact us directly.</li>
                    <li>Refunds, where applicable, will be processed to the original payment method within 7–14 business days.</li>
                    <li>In exceptional circumstances (force majeure, government restrictions, property closure), we will offer a full refund or alternative dates at our discretion.</li>
                  </ul>
                </Section>

                <Section id="checkin" title="4. Check-in & Check-out">
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li><strong>Check-in:</strong> From 2:00 pm on your arrival date. Early check-in from 12:00 pm may be available subject to room availability and may attract an additional charge.</li>
                    <li><strong>Check-out:</strong> By 12:00 noon on your departure date. Late check-out until 2:00 pm may be available on request and may attract an additional charge.</li>
                    <li>Valid government-issued photo identification is required at check-in for all adult guests.</li>
                    <li>The Resort reserves the right to pre-authorise a security deposit on your payment card at check-in to cover any potential incidental charges.</li>
                    <li>Guests who fail to arrive without prior notice (no-show) will be charged in accordance with the applicable cancellation policy.</li>
                  </ul>
                </Section>

                <Section id="conduct" title="5. Guest Conduct & Responsibilities">
                  <p style={{ marginBottom: 'var(--space-4)' }}>
                    All guests are expected to conduct themselves in a manner that is respectful to other guests, staff, and the property.
                  </p>
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li>Guests are responsible for any damage caused to the room or property during their stay. The cost of repair or replacement will be charged to the guest.</li>
                    <li>Smoking is not permitted in guest rooms or enclosed areas of the property. A deep-cleaning fee will be charged for violations.</li>
                    <li>Pets are not permitted on the property unless prior written approval has been granted.</li>
                    <li>Quiet hours apply between 10:00 pm and 7:00 am. Excessive noise that disturbs other guests may result in termination of the stay without refund.</li>
                    <li>The Resort reserves the right to remove any guest whose conduct is deemed disruptive, dangerous, or in violation of these terms.</li>
                    <li>Visitors to guest rooms must be registered at the front desk. Unregistered overnight guests are not permitted.</li>
                  </ul>
                </Section>

                <Section id="facilities" title="6. Facilities & Services">
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li>Access to hotel facilities (pool, restaurant, bar) is subject to the operational hours and rules of each facility.</li>
                    <li>The Resort reserves the right to close, restrict, or modify any facility or service at any time without prior notice, including for maintenance, safety, or events.</li>
                    <li>Children must be supervised by an adult at all times in the pool area and other communal facilities.</li>
                    <li>The Resort is not responsible for items left unattended in communal areas.</li>
                  </ul>
                </Section>

                <Section id="liability" title="7. Liability">
                  <p style={{ marginBottom: 'var(--space-4)' }}>
                    Stanzel Grand Resort takes reasonable care to ensure the safety and comfort of all guests. However:
                  </p>
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li>We are not liable for loss, theft, or damage to guest property, including vehicles parked on the premises, except where caused by the proven negligence of the Resort.</li>
                    <li>We strongly recommend that guests obtain appropriate travel insurance before their stay.</li>
                    <li>Our liability to any guest shall not exceed the total value of that guest's reservation in any circumstance.</li>
                    <li>We are not liable for any failure to provide services caused by events beyond our reasonable control, including power outages, natural disasters, or government actions.</li>
                  </ul>
                </Section>

                <Section id="website" title="8. Website Use">
                  <ul style={{ paddingLeft: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <li>You agree to use our website only for lawful purposes and in a manner that does not infringe the rights of others or restrict their use.</li>
                    <li>We make every effort to ensure the accuracy of information on our website but cannot guarantee it is always complete or current.</li>
                    <li>We reserve the right to modify, suspend, or discontinue any part of the website at any time without notice.</li>
                    <li>Unauthorised use of this website, including scraping, systematic downloading, or automated booking, is prohibited.</li>
                  </ul>
                </Section>

                <Section id="ip" title="9. Intellectual Property">
                  <p>
                    All content on this website — including text, photographs, graphics, logos, and design — is the property of Stanzel Grand Resort or its licensors and is protected by applicable intellectual property law.
                    You may not reproduce, distribute, or use any content without our prior written permission.
                  </p>
                </Section>

                <Section id="governing" title="10. Governing Law">
                  <p>
                    These Terms &amp; Conditions are governed by and construed in accordance with the laws of the Federal Republic of Nigeria.
                    Any disputes arising from or in connection with these terms shall be subject to the exclusive jurisdiction of the courts of the Federal Capital Territory, Abuja.
                  </p>
                </Section>

                <Section id="contact" title="11. Contact">
                  <p style={{ marginBottom: 'var(--space-4)' }}>
                    If you have any questions about these terms, please contact us:
                  </p>
                  <address style={{ fontStyle: 'normal', lineHeight: 2 }}>
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
                  <Link href="/privacy" style={{ color: 'var(--color-green)', fontSize: 'var(--text-sm)', textDecoration: 'underline' }}>
                    ← Privacy Policy
                  </Link>
                  <Link href="/contact" className="btn btn-outline-dark btn-sm">Contact Us</Link>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
      <Footer />

      <style>{`
        .terms-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: var(--space-12);
          align-items: start;
        }
        @media (max-width: 900px) {
          .terms-layout {
            grid-template-columns: 1fr;
          }
          .terms-toc {
            display: none;
          }
        }
        .toc-link:hover { color: var(--color-green) !important; }
      `}</style>
    </>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Special Offers & Packages',
  description:
    'Discover exclusive offers, packages and seasonal deals at Stanzel Grand Resort, Abuja. Book direct for the best rates — honeymoon packages, weekend escapes, extended stay discounts and more.',
};

const OFFERS = [
  {
    id: 'direct-booking',
    badge: 'Best Rate Guarantee',
    badgeVariant: 'gold',
    title: 'Book Direct, Save More',
    description:
      'When you book directly through our website, you always get the best available rate — guaranteed. No hidden fees, flexible modification terms, and complimentary early check-in subject to availability.',
    highlights: [
      'Guaranteed lowest rate',
      'Flexible cancellation',
      'Priority room assignment',
      'Complimentary upgrade (subject to availability)',
    ],
    image: '/images/room-suite.jpg',
    cta: { label: 'Book Direct Now', href: '/booking' },
    tag: 'Always available',
  },
  {
    id: 'honeymoon',
    badge: 'Romance Package',
    badgeVariant: 'green',
    title: 'Honeymoon & Anniversary Escape',
    description:
      'Celebrate your love with a carefully curated romance package. Arrive to a room dressed with fresh flowers and a chilled bottle of champagne, enjoy a private dinner for two, and wake to a leisurely in-room breakfast.',
    highlights: [
      'Room décor with flowers & champagne on arrival',
      'Private candlelit dinner for two',
      'Full Nigerian & continental breakfast in-room',
      'Late check-out until 2 pm',
    ],
    image: '/images/pool-evening.jpg',
    cta: { label: 'Enquire About This Package', href: '/contact?type=booking' },
    tag: 'Bookable in advance',
  },
  {
    id: 'weekend',
    badge: 'Weekend Escape',
    badgeVariant: 'gold',
    title: 'Weekend Retreat',
    description:
      'Escape the week with a two-night Friday–Sunday stay. Enjoy a relaxed poolside Saturday, unwind at the bar with curated cocktails, and savour a Sunday brunch before a leisurely late check-out.',
    highlights: [
      'Two-night stay (Fri–Sun)',
      'Daily breakfast for two included',
      'Complimentary welcome drink on arrival',
      'Late check-out until 1 pm on Sunday',
    ],
    image: '/images/lobby.jpg',
    cta: { label: 'Book a Weekend Stay', href: '/booking' },
    tag: 'Friday & Saturday arrival',
  },
  {
    id: 'extended',
    badge: 'Extended Stay',
    badgeVariant: 'green',
    title: 'Long-Stay Privilege',
    description:
      'For guests staying seven or more nights, we offer a preferential rate alongside a suite of exclusive benefits. Perfect for business travellers, relocating professionals and leisure guests who prefer to settle in at their own pace.',
    highlights: [
      'Preferential nightly rate from 7+ nights',
      'Daily laundry service included',
      'Dedicated front-desk liaison',
      'Complimentary airport transfer (Abuja Airport)',
    ],
    image: '/images/bathroom.jpg',
    cta: { label: 'Enquire About Long Stays', href: '/contact?type=booking' },
    tag: '7+ night stays',
  },
  {
    id: 'dining',
    badge: 'Dining Privilege',
    badgeVariant: 'gold',
    title: 'Dine & Stay Package',
    description:
      'Combine your accommodation with a curated dining credit at our restaurant and bar. Savour the full Stanzel culinary experience — from a Nigerian breakfast to a champagne dinner — with a generous food and beverage allowance included.',
    highlights: [
      'Daily breakfast for two',
      'One à la carte dinner credit per stay',
      'Welcome cocktail on arrival',
      'Bar credit for in-stay drinks',
    ],
    image: '/images/restaurant.jpg',
    cta: { label: 'Book the Dine & Stay Package', href: '/booking' },
    tag: 'Select rate plans',
  },
  {
    id: 'corporate',
    badge: 'Corporate Rate',
    badgeVariant: 'green',
    title: 'Business & Corporate Rates',
    description:
      'Stanzel Grand Resort is the preferred choice for business travellers and corporate stays in Abuja. We offer negotiated corporate rates, priority reservations and flexible billing arrangements for companies and organisations.',
    highlights: [
      'Preferential corporate nightly rate',
      'Flexible invoice billing for companies',
      'Priority reservations for frequent guests',
      'Meeting room access on request',
    ],
    image: '/images/aerial.jpg',
    cta: { label: 'Contact Our Corporate Team', href: '/contact?type=booking' },
    tag: 'By arrangement',
  },
];

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  gold: {
    background: 'rgba(201,169,110,0.15)',
    color: 'var(--color-gold)',
    border: '1px solid rgba(201,169,110,0.35)',
  },
  green: {
    background: 'rgba(26,60,52,0.1)',
    color: 'var(--color-green)',
    border: '1px solid rgba(26,60,52,0.2)',
  },
};

export default function OffersPage() {
  return (
    <>
      <Header />
      <main id="main-content">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section style={{ position: 'relative', height: '440px', display: 'flex', alignItems: 'flex-end' }}>
          <Image
            src="/images/pool-evening.jpg"
            alt="Stanzel Grand Resort pool at dusk — special offers"
            fill priority
            style={{ objectFit: 'cover', objectPosition: 'center 60%' }}
            sizes="100vw"
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,38,32,0.88) 0%, rgba(16,38,32,0.25) 60%)' }} />
          <div className="container" style={{ position: 'relative', zIndex: 2, paddingBottom: 'var(--space-16)' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-3)' }}>Exclusive Deals</p>
            <h1 style={{ color: 'var(--color-ivory)', maxWidth: 560 }}>Special Offers &amp; Packages</h1>
            <p style={{ color: 'rgba(250,248,244,0.75)', maxWidth: 480, marginTop: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>
              Curated packages and preferential rates crafted to make every stay at Stanzel Grand Resort even more special.
            </p>
          </div>
        </section>

        {/* ── Best-rate banner ─────────────────────────────────── */}
        <section style={{ background: 'var(--color-gold)', padding: 'var(--space-5) 0' }}>
          <div className="container" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-green-dark)', letterSpacing: '0.04em' }}>
              🏆 &nbsp;Best Rate Guarantee — book direct and always pay less than third-party sites.
            </p>
            <Link href="/booking" className="btn btn-sm" style={{ background: 'var(--color-green-dark)', color: 'var(--color-gold)', border: 'none', whiteSpace: 'nowrap' }}>
              Book Direct
            </Link>
          </div>
        </section>

        {/* ── Offers grid ──────────────────────────────────────── */}
        <section className="section">
          <div className="container">
            <div className="section-header center" style={{ marginBottom: 'var(--space-16)' }}>
              <p className="eyebrow">Our Packages</p>
              <h2>Experiences Designed for You</h2>
              <span className="gold-divider gold-divider-center" />
              <p>Each offer is designed to enhance your stay. All packages are subject to availability — contact us to confirm details and arrange your reservation.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
              {OFFERS.map((offer, i) => (
                <article key={offer.id} className="offer-card" style={{
                  display: 'grid',
                  gridTemplateColumns: i % 2 === 0 ? '1fr 1.1fr' : '1.1fr 1fr',
                  gap: 'var(--space-0)',
                  borderRadius: 'var(--radius-2xl)',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  background: 'var(--color-white)',
                }}>
                  {/* Image */}
                  <div style={{ position: 'relative', minHeight: '320px', order: i % 2 === 0 ? 0 : 1 }}>
                    <Image
                      src={offer.image}
                      alt={offer.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 45vw"
                    />
                    {/* Tag ribbon */}
                    <div style={{
                      position: 'absolute', bottom: 'var(--space-4)', left: 'var(--space-4)',
                      background: 'rgba(16,38,32,0.85)', backdropFilter: 'blur(8px)',
                      borderRadius: 'var(--radius-md)', padding: '4px 12px',
                    }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {offer.tag}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ padding: 'var(--space-10)', order: i % 2 === 0 ? 1 : 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {/* Badge */}
                    <span style={{
                      display: 'inline-block',
                      fontSize: 'var(--text-xs)', fontWeight: 700,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      padding: '4px 14px', borderRadius: '999px',
                      marginBottom: 'var(--space-4)',
                      alignSelf: 'flex-start',
                      ...BADGE_STYLES[offer.badgeVariant],
                    }}>
                      {offer.badge}
                    </span>

                    <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)', lineHeight: 1.2 }}>{offer.title}</h2>
                    <span className="gold-divider" />
                    <p style={{ marginBottom: 'var(--space-6)', lineHeight: 1.7 }}>{offer.description}</p>

                    {/* Highlights */}
                    <ul style={{ listStyle: 'none', marginBottom: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {offer.highlights.map(h => (
                        <li key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ color: 'var(--color-gold)', fontWeight: 700, lineHeight: '1.6', flexShrink: 0 }}>✓</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>

                    <div>
                      <Link href={offer.cta.href} className="btn btn-primary">
                        {offer.cta.label}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Fine print ───────────────────────────────────────── */}
        <section style={{ background: 'var(--color-ivory-dark)', padding: 'var(--space-12) 0' }}>
          <div className="container" style={{ textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Terms &amp; Conditions</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              All packages and offers are subject to availability and may vary by season. Rates are quoted per room per night unless otherwise stated.
              Package inclusions must be arranged with the front desk at time of booking. Stanzel Grand Resort reserves the right to amend or withdraw any offer at any time.
              For package reservations or corporate enquiries please contact us directly.
            </p>
            <Link href="/contact" className="btn btn-outline-dark btn-sm" style={{ marginTop: 'var(--space-6)' }}>
              Contact Reservations Team
            </Link>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section style={{ background: 'var(--color-green)', padding: 'var(--space-16) 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)' }}>Ready to Experience Stanzel?</p>
            <h2 style={{ color: 'var(--color-ivory)', marginTop: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              Book Your Stay Today
            </h2>
            <p style={{ color: 'rgba(250,248,244,0.7)', maxWidth: 480, margin: '0 auto var(--space-8)', fontSize: 'var(--text-lg)' }}>
              Check live availability and secure your preferred package directly for the guaranteed best rate.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/booking" className="btn btn-primary btn-lg">Check Availability</Link>
              <Link href="/contact" className="btn btn-outline-light btn-lg">Speak to Our Team</Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />

      <style>{`
        /* Offer card — stack on mobile */
        @media (max-width: 900px) {
          .offer-card {
            grid-template-columns: 1fr !important;
          }
          .offer-card > div[style*="order"] {
            order: 0 !important;
            min-height: 240px !important;
          }
          .offer-card > div:last-child {
            order: 1 !important;
            padding: var(--space-6) !important;
          }
        }
      `}</style>
    </>
  );
}

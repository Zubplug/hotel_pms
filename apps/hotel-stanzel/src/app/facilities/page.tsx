import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Resort Facilities',
  description: 'Discover the facilities at Stanzel Grand Resort in Abuja — our swimming pool, restaurant and bar, garden spaces, and premium accommodations.',
};

const FACILITIES = [
  {
    id: 'pool',
    title: 'Swimming Pool',
    description:
      'Our resort swimming pool is the centrepiece of our outdoor leisure area. Surrounded by manicured tropical gardens and shaded seating, it is the perfect place to unwind, cool off, or simply soak in the lush Abuja surroundings.',
    features: ['Outdoor pool', 'Pool deck seating', 'Towel service', 'Garden surrounds'],
    image: '/images/pool-evening.jpg',
    imageAlt: 'Resort swimming pool at dusk',
  },
  {
    id: 'restaurant',
    title: 'Restaurant & Bar',
    description:
      'From a relaxed breakfast to a formal dinner, our full-service restaurant and well-stocked bar cater to every culinary mood. Nigerian and continental cuisine, premium spirits, wines, and craft cocktails are all part of the experience.',
    features: ['Full-service restaurant', 'Premium cocktail bar', 'Nigerian & continental menu', 'Wine and champagne selection'],
    image: '/images/restaurant.jpg',
    imageAlt: 'Stanzel Grand Resort restaurant interior',
  },
  {
    id: 'lobby',
    title: 'Grand Lobby & Reception',
    description:
      'The Stanzel Grand Lobby sets the tone for every stay. With soaring ceilings, crystal lighting, polished marble floors and African-inspired artwork, our lobby is a landmark in itself — the start and end of every memorable stay.',
    features: ['24-hour front desk', 'Concierge services', 'Luggage storage', 'Airport transfer arrangement'],
    image: '/images/lobby.jpg',
    imageAlt: 'Stanzel Grand Resort lobby interior',
  },
  {
    id: 'rooms',
    title: 'Premium Guest Rooms',
    description:
      'Each room and suite has been thoughtfully designed with premium furniture, quality linens, modern amenities and distinctive African character. Garden views, en-suite marble bathrooms and attentive room service complete the experience.',
    features: ['Premium furnishing', 'En-suite bathrooms', 'Air conditioning', 'Room service'],
    image: '/images/room-suite.jpg',
    imageAlt: 'Luxury guest suite',
  },
];

export default function FacilitiesPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section style={{ position: 'relative', height: '480px', display: 'flex', alignItems: 'flex-end' }}>
          <Image src="/images/aerial.jpg" alt="Stanzel Grand Resort aerial view" fill priority style={{ objectFit: 'cover', objectPosition: 'center' }} sizes="100vw" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,38,32,0.88) 0%, rgba(16,38,32,0.25) 55%)' }} />
          <div className="container" style={{ position: 'relative', zIndex: 2, paddingBottom: 'var(--space-16)' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-3)' }}>Resort Facilities</p>
            <h1 style={{ color: 'var(--color-ivory)', maxWidth: 580 }}>Everything You Need, In One Place</h1>
          </div>
        </section>

        {/* Individual facilities */}
        <section className="section">
          <div className="container">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-16)' }}>
              {FACILITIES.map(({ id, title, description, features, image, imageAlt }, i) => (
                <article key={id} style={{
                  display: 'grid',
                  gridTemplateColumns: i % 2 === 0 ? '1.1fr 1fr' : '1fr 1.1fr',
                  gap: 'var(--space-12)',
                  alignItems: 'center',
                }}>
                  <div style={{ order: i % 2 === 0 ? 0 : 1 }}>
                    <div style={{ position: 'relative', height: '400px', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                      <Image src={image} alt={imageAlt} fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 50vw" />
                    </div>
                  </div>
                  <div style={{ order: i % 2 === 0 ? 1 : 0 }}>
                    <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Facility</p>
                    <h2 style={{ marginBottom: 'var(--space-4)' }}>{title}</h2>
                    <span className="gold-divider" />
                    <p style={{ marginBottom: 'var(--space-6)' }}>{description}</p>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
                      {features.map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(26,60,52,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="3" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ background: 'var(--color-green)', padding: 'var(--space-16) 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--color-ivory)', marginBottom: 'var(--space-4)' }}>Access All Facilities With Your Stay</h2>
            <p style={{ color: 'rgba(250,248,244,0.7)', marginBottom: 'var(--space-8)', maxWidth: 480, margin: '0 auto var(--space-8)' }}>
              Every Stanzel Grand Resort guest enjoys access to our pool, restaurant, bar, and all leisure facilities.
            </p>
            <Link href="/booking" className="btn btn-primary btn-lg">Book Your Stay</Link>
          </div>
        </section>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 900px) {
          article[style] { grid-template-columns: 1fr !important; }
          article > div { order: 0 !important; }
        }
      `}</style>
    </>
  );
}

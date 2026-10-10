import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Restaurant & Bar — Dining',
  description: 'Experience fine Nigerian and continental dining at Stanzel Grand Resort, Abuja. Our restaurant and bar serve breakfast through evening meals with an extensive drinks selection.',
};

// Confirmed from POS audit: Nigerian & continental cuisine, full bar with wine, spirits, champagne
const DINING_FEATURES = [
  { icon: '🌍', title: 'Nigerian Cuisine', description: 'Authentic flavours — pepper soup, egusi, jollof rice, suya and seasonal specials prepared with the finest local produce.' },
  { icon: '🥩', title: 'Continental Classics', description: 'Grilled meats, fresh salads, pasta, and international dishes crafted for discerning guests.' },
  { icon: '🍷', title: 'Curated Wine List', description: 'An extensive selection of wines from leading New World and Old World producers, chosen to complement our menu.' },
  { icon: '🥃', title: 'Premium Spirits Bar', description: 'Scotch, cognac, rum, gin, vodka and premium mixers — paired with expertly crafted cocktails.' },
  { icon: '🥂', title: 'Champagne & Sparkling', description: 'A curated champagne menu for celebrations, anniversaries and special occasions.' },
  { icon: '☕', title: 'Breakfast Service', description: 'Start your morning with a continental or full breakfast, served in the restaurant or available to your room.' },
];

export default function DiningPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section style={{ position: 'relative', height: '520px', display: 'flex', alignItems: 'flex-end' }}>
          <Image src="/images/restaurant.jpg" alt="Stanzel Grand Resort restaurant and bar" fill priority style={{ objectFit: 'cover', objectPosition: 'center' }} sizes="100vw" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,38,32,0.88) 0%, rgba(16,38,32,0.2) 55%)' }} />
          <div className="container" style={{ position: 'relative', zIndex: 2, paddingBottom: 'var(--space-16)' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-3)' }}>Culinary Experience</p>
            <h1 style={{ color: 'var(--color-ivory)', maxWidth: 560 }}>Restaurant &amp; Bar</h1>
            <p style={{ color: 'rgba(250,248,244,0.8)', maxWidth: 480, marginTop: 'var(--space-4)', fontSize: 'var(--text-lg)' }}>
              Nigerian warmth, international precision — a dining experience crafted for every occasion.
            </p>
          </div>
        </section>

        {/* Intro */}
        <section className="section">
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-16)', alignItems: 'center' }}>
              <div>
                <p className="eyebrow">The Restaurant</p>
                <h2>A Taste of Distinction</h2>
                <span className="gold-divider" />
                <p style={{ marginBottom: 'var(--space-5)' }}>
                  Our restaurant brings together the best of Nigerian and continental cuisine in a setting designed for both relaxed meals and special celebrations. The open dining room, illuminated by warm pendant lights and framed by floor-to-ceiling windows, creates an atmosphere of understated elegance.
                </p>
                <p style={{ marginBottom: 'var(--space-8)' }}>
                  Our culinary team sources fresh, quality ingredients to deliver dishes that are both deeply flavourful and beautifully presented. Whether you are joining us for a working breakfast, a family lunch or a romantic dinner, every visit is an occasion worth savouring.
                </p>
                <Link href="/booking" className="btn btn-secondary">Reserve a Table via Booking</Link>
              </div>
              <div style={{ position: 'relative', height: '460px', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                <Image src="/images/bar.jpg" alt="Stanzel Grand Resort bar" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
            </div>
          </div>
        </section>

        {/* Dining features */}
        <section className="section" style={{ background: 'var(--color-ivory-dark)' }}>
          <div className="container">
            <div className="section-header center" style={{ marginBottom: 'var(--space-16)' }}>
              <p className="eyebrow">What We Offer</p>
              <h2>Dining Highlights</h2>
              <span className="gold-divider gold-divider-center" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
              {DINING_FEATURES.map(({ icon, title, description }) => (
                <div key={title} className="dining-feature-card">
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--space-4)' }}>{icon}</span>
                  <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' }}>{title}</h3>
                  <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bar section */}
        <section className="section">
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-16)', alignItems: 'center' }}>
              <div style={{ position: 'relative', height: '460px', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                <Image src="/images/restaurant.jpg" alt="Stanzel Grand Resort restaurant interior" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
              <div>
                <p className="eyebrow">The Bar</p>
                <h2>A Bar Worth Lingering In</h2>
                <span className="gold-divider" />
                <p style={{ marginBottom: 'var(--space-5)' }}>
                  Our fully stocked bar is the perfect place to unwind after a day of meetings or sightseeing. With an extensive spirits menu, curated champagnes, wines by the glass or bottle, and expertly crafted cocktails, every drink is a considered pleasure.
                </p>
                <p style={{ marginBottom: 'var(--space-8)' }}>
                  From a sundowner on the terrace to a late-night nightcap, the Stanzel bar is always ready to welcome you with warmth and craftsmanship.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {['Wines', 'Champagne', 'Scotch', 'Cognac', 'Craft Cocktails', 'Non-Alcoholic'].map(item => (
                    <span key={item} className="badge badge-gold">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Note on menus */}
        <section style={{ background: 'var(--color-green)', padding: 'var(--space-12) 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <p style={{ color: 'rgba(250,248,244,0.7)', fontSize: 'var(--text-sm)', maxWidth: 560, margin: '0 auto' }}>
              Menus, opening hours and table reservation details are available at the property. For enquiries, please contact our front desk or use the contact form below.
            </p>
            <Link href="/contact" className="btn btn-outline-light btn-sm" style={{ marginTop: 'var(--space-6)' }}>
              Dining Enquiry
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <style>{`
        .dining-feature-card {
          padding: var(--space-8);
          background: var(--color-white);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border);
          transition: transform var(--duration-md) var(--ease),
                      box-shadow var(--duration-md) var(--ease);
        }
        .dining-feature-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </>
  );
}

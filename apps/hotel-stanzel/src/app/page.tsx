import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DateSearchWidget } from '@/components/booking/DateSearchWidget';
import { getRoomTypes } from '@/lib/lodgecore';

export const metadata: Metadata = {
  title: 'Stanzel Grand Resort — Luxury Hospitality in Nigeria',
  description:
    'Experience world-class luxury at Stanzel Grand Resort. Premium guest rooms, fine dining, and seamless hospitality.',
};

// Revalidate room data every hour
export const revalidate = 3600;

const CONFIRMED_FACILITIES = [
  {
    id: 'restaurant',
    title: 'Restaurant & Bar',
    description:
      'Nigerian and continental cuisine in a refined setting. Our full-service restaurant and bar serves breakfast through evening dining.',
    icon: '🍽️',
    image: '/images/restaurant.jpg',
    href: '/dining',
  },
  {
    id: 'pool',
    title: 'Swimming Pool',
    description:
      'Unwind beside our resort swimming pool, surrounded by manicured tropical gardens and tranquil atmosphere.',
    icon: '🏊',
    image: '/images/pool-evening.jpg',
    href: '/facilities',
  },
  {
    id: 'rooms',
    title: 'Premium Accommodations',
    description:
      'Thoughtfully designed guest rooms and suites with modern amenities, warm African aesthetics, and garden views.',
    icon: '🛏️',
    image: '/images/room-suite.jpg',
    href: '/rooms',
  },
];

const GALLERY_IMAGES = [
  { src: '/images/hero-entrance.jpg', alt: 'Stanzel Grand Resort entrance' },
  { src: '/images/room-suite.jpg', alt: 'Luxury guest suite' },
  { src: '/images/restaurant.jpg', alt: 'Restaurant and bar' },
  { src: '/images/pool-evening.jpg', alt: 'Resort swimming pool at dusk' },
];

export default async function HomePage() {
  // Fetch real room types from LodgeCore — gracefully degrade if API is unavailable
  let rooms: Awaited<ReturnType<typeof getRoomTypes>>['data'] = [];
  try {
    const { data } = await getRoomTypes();
    rooms = data.slice(0, 3); // Show up to 3 featured rooms on homepage
  } catch {
    // API not yet configured — proceed with empty rooms; booking CTA still visible
  }

  return (
    <>
      <Header />
      <main id="main-content">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section
          id="hero"
          aria-label="Hero — Stanzel Grand Resort"
          style={{
            position: 'relative',
            minHeight: '100svh',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            background: 'var(--color-green-dark)',
          }}
        >
          {/* Background image */}
          <Image
            src="/images/hero-entrance.jpg"
            alt="Stanzel Grand Resort — grand entrance at golden hour"
            fill
            priority
            quality={85}
            style={{ objectFit: 'cover', objectPosition: 'center 30%' }}
            sizes="100vw"
          />

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(16,38,32,0.82) 0%, rgba(16,38,32,0.45) 50%, rgba(16,38,32,0.65) 100%)',
          }} />

          {/* Content */}
          <div className="container" style={{
            position: 'relative', zIndex: 2,
            paddingTop: 'calc(var(--nav-height) + var(--space-12))',
            paddingBottom: 'var(--space-24)',
          }}>
            <div style={{ maxWidth: '720px' }}>
              <p className="eyebrow animate-fade-in-up" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-5)' }}>
                Welcome to Stanzel Grand Resort
              </p>
              <h1
                className="animate-fade-in-up delay-100"
                style={{ color: 'var(--color-ivory)', fontWeight: 300, lineHeight: 1.1 }}
              >
                Where Luxury<br />
                <em style={{ fontStyle: 'italic', color: 'var(--color-gold)' }}>Meets</em> Warmth
              </h1>
              <p className="animate-fade-in-up delay-200" style={{
                fontSize: 'var(--text-xl)', color: 'rgba(250,248,244,0.8)',
                marginTop: 'var(--space-6)', marginBottom: 'var(--space-10)',
                maxWidth: '560px', lineHeight: 1.6,
              }}>
                An oasis of refined hospitality, curated dining, and genuine Nigerian welcome — crafted for guests who expect the extraordinary.
              </p>
              <div className="animate-fade-in-up delay-300"
                style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <Link href="/booking" className="btn btn-primary btn-lg">
                  Reserve Your Stay
                </Link>
                <Link href="/rooms" className="btn btn-outline-light btn-lg">
                  Explore Rooms
                </Link>
              </div>
            </div>

            {/* Booking widget */}
            <div className="animate-fade-in-up delay-400" style={{ marginTop: 'var(--space-16)', maxWidth: '860px' }}>
              <DateSearchWidget />
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: 'absolute', bottom: 'var(--space-8)', left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 'var(--space-2)', color: 'rgba(250,248,244,0.5)',
          }}>
            <span style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Discover
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </section>

        {/* ── Intro Band ─────────────────────────────────────────── */}
        <section aria-label="Resort introduction" style={{
          background: 'var(--color-green)',
          padding: 'var(--space-12) 0',
        }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
              fontStyle: 'italic',
              fontWeight: 300,
              color: 'rgba(250,248,244,0.9)',
              maxWidth: '680px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}>
              "A sanctuary of elegance where every detail is crafted to exceed your expectations."
            </p>
          </div>
        </section>

        {/* ── Featured Rooms ────────────────────────────────────── */}
        {rooms.length > 0 && (
          <section id="rooms" className="section" aria-labelledby="rooms-heading">
            <div className="container">
              <div className="section-header center" style={{ marginBottom: 'var(--space-16)' }}>
                <p className="eyebrow">Accommodations</p>
                <h2 id="rooms-heading">Rooms &amp; Suites</h2>
                <span className="gold-divider gold-divider-center" />
                <p>Thoughtfully appointed guest rooms combining modern comforts with warm, distinctly Nigerian character.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-8)' }}>
                {rooms.map((room) => (
                  <article key={room.id} className="card" aria-label={room.name}>
                    <div style={{ position: 'relative', height: '260px', overflow: 'hidden' }}>
                      {room.photos?.[0] ? (
                        <Image
                          src={room.photos[0]}
                          alt={room.name}
                          fill
                          style={{ objectFit: 'cover', transition: 'transform var(--duration-lg) var(--ease)' }}
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="room-img"
                        />
                      ) : (
                        <Image
                          src="/images/room-suite.jpg"
                          alt={room.name}
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      )}
                      <div style={{
                        position: 'absolute', bottom: 'var(--space-4)', left: 'var(--space-4)',
                      }}>
                        <span className="badge badge-gold">Up to {room.maxOccupancy} guests</span>
                      </div>
                    </div>
                    <div className="card-body">
                      <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' }}>{room.name}</h3>
                      {room.description && (
                        <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {room.description}
                        </p>
                      )}
                      {room.amenities?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
                          {room.amenities.slice(0, 4).map((a) => (
                            <span key={a} style={{
                              fontSize: 'var(--text-xs)', padding: '3px 10px',
                              background: 'var(--color-ivory-dark)', borderRadius: '999px',
                              color: 'var(--text-muted)',
                            }}>
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', color: 'var(--color-green)', margin: 0 }}>
                          {room.currency} {Number(room.baseRate).toLocaleString()}
                          <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--text-muted)' }}>/night</span>
                        </p>
                        <Link href="/booking" className="btn btn-secondary btn-sm">Book</Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
                <Link href="/rooms" className="btn btn-outline-dark btn-lg">View All Rooms &amp; Suites</Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Facilities ────────────────────────────────────────── */}
        <section id="facilities" className="section" aria-labelledby="facilities-heading"
          style={{ background: 'var(--color-ivory-dark)' }}>
          <div className="container">
            <div className="section-header center" style={{ marginBottom: 'var(--space-16)' }}>
              <p className="eyebrow">The Resort</p>
              <h2 id="facilities-heading">Resort Facilities</h2>
              <span className="gold-divider gold-divider-center" />
              <p>From fine dining to leisure, every aspect of your stay at Stanzel Grand Resort is crafted with care.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-8)' }}>
              {CONFIRMED_FACILITIES.map(({ id, title, description, image, href }) => (
                <Link key={id} href={href} style={{ display: 'block', textDecoration: 'none' }}>
                  <article
                    style={{
                      position: 'relative', height: '400px', borderRadius: 'var(--radius-xl)',
                      overflow: 'hidden', cursor: 'pointer',
                    }}
                  >
                    <Image
                      src={image}
                      alt={title}
                      fill
                      style={{ objectFit: 'cover', transition: 'transform var(--duration-lg) var(--ease)' }}
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(16,38,32,0.9) 0%, rgba(16,38,32,0.1) 50%)',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      padding: 'var(--space-8)',
                    }}>
                      <h3 style={{ color: 'var(--color-ivory)', fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>
                        {title}
                      </h3>
                      <p style={{ color: 'rgba(250,248,244,0.75)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                        {description}
                      </p>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
                        marginTop: 'var(--space-5)',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                        fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'var(--color-gold)',
                      }}>
                        Discover
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Dining highlight ─────────────────────────────────── */}
        <section id="dining" className="section" aria-labelledby="dining-heading">
          <div className="container">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 'var(--space-16)',
              alignItems: 'center',
            }}>
              <div>
                <p className="eyebrow">Culinary Experience</p>
                <h2 id="dining-heading">Restaurant &amp; Bar</h2>
                <span className="gold-divider" />
                <p style={{ marginBottom: 'var(--space-6)' }}>
                  Our restaurant celebrates the richness of Nigerian cuisine alongside continental classics.
                  An extensive bar stocks a curated selection of wines, champagnes, spirits and craft cocktails —
                  perfect for a sundowner or a celebratory evening.
                </p>
                <p style={{ marginBottom: 'var(--space-8)' }}>
                  Whether you are starting your day with a continental breakfast or ending it with pepper soup
                  and fine Scotch, our culinary team delivers every dish with precision and warmth.
                </p>
                <Link href="/dining" className="btn btn-secondary">
                  View Dining &amp; Menu
                </Link>
              </div>
              <div style={{ position: 'relative', height: '480px', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                <Image
                  src="/images/restaurant.jpg"
                  alt="Stanzel Grand Resort restaurant and bar"
                  fill
                  style={{ objectFit: 'cover' }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Gallery strip ─────────────────────────────────────── */}
        <section id="gallery" className="section" aria-labelledby="gallery-heading"
          style={{ background: 'var(--color-ivory-dark)' }}>
          <div className="container">
            <div className="section-header center" style={{ marginBottom: 'var(--space-12)' }}>
              <p className="eyebrow">Visual Journey</p>
              <h2 id="gallery-heading">The Resort in Pictures</h2>
              <span className="gold-divider gold-divider-center" />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              gridTemplateRows: '240px 240px',
              gap: 'var(--space-4)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
            }}>
              {GALLERY_IMAGES.map(({ src, alt }, i) => (
                <div key={i} style={{
                  position: 'relative',
                  gridRow: i === 0 ? 'span 2' : 'span 1',
                  overflow: 'hidden',
                }}>
                  <Image src={src} alt={alt} fill style={{ objectFit: 'cover', transition: 'transform var(--duration-lg) var(--ease)' }}
                    sizes="(max-width: 768px) 100vw, 33vw" />
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 'var(--space-10)' }}>
              <Link href="/gallery" className="btn btn-outline-dark">View Full Gallery</Link>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────── */}
        <section id="cta" aria-labelledby="cta-heading"
          style={{ background: 'var(--color-green)', padding: 'var(--space-24) 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)' }}>Begin Your Journey</p>
            <h2 id="cta-heading" style={{ color: 'var(--color-ivory)', marginTop: 'var(--space-4)' }}>
              Reserve Your Stay
            </h2>
            <span className="gold-divider gold-divider-center" style={{ opacity: 0.4 }} />
            <p style={{
              color: 'rgba(250,248,244,0.7)',
              fontSize: 'var(--text-lg)',
              maxWidth: '520px',
              margin: '0 auto var(--space-10)',
            }}>
              Experience the warmth of Stanzel Grand Resort. Check availability and book directly for the best rates.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/booking" className="btn btn-primary btn-lg">
                Check Availability
              </Link>
              <Link href="/contact" className="btn btn-outline-light btn-lg">
                Contact Us
              </Link>
            </div>
          </div>
        </section>

      </main>
      <Footer />

      <style>{`
        .room-img:hover { transform: scale(1.04); }
      `}</style>
    </>
  );
}

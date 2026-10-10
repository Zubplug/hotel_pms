import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getRoomTypes } from '@/lib/lodgecore';

export const metadata: Metadata = {
  title: 'Rooms & Suites',
  description: 'Explore premium rooms and suites at Stanzel Grand Resort in Gwarinpa, Abuja. Each room is thoughtfully appointed with modern amenities and warm Nigerian character.',
};

export const revalidate = 3600;

export default async function RoomsPage() {
  let rooms: Awaited<ReturnType<typeof getRoomTypes>>['data'] = [];
  try { const { data } = await getRoomTypes(); rooms = data; } catch { /* graceful degradation */ }

  return (
    <>
      <Header />
      <main id="main-content">
        {/* Page hero */}
        <section style={{ position: 'relative', height: '480px', display: 'flex', alignItems: 'flex-end' }}>
          <Image src="/images/room-suite.jpg" alt="Luxury guest suite at Stanzel Grand Resort" fill priority style={{ objectFit: 'cover', objectPosition: 'center 40%' }} sizes="100vw" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,38,32,0.85) 0%, rgba(16,38,32,0.3) 60%)' }} />
          <div className="container" style={{ position: 'relative', zIndex: 2, paddingBottom: 'var(--space-16)' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-3)' }}>Accommodations</p>
            <h1 style={{ color: 'var(--color-ivory)', maxWidth: 560 }}>Rooms &amp; Suites</h1>
          </div>
        </section>

        <section className="section">
          <div className="container">
            {rooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>
                  Room information is currently unavailable. Please contact us directly.
                </p>
                <Link href="/contact" className="btn btn-secondary">Contact Us</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
                {rooms.map((room, i) => (
                  <article key={room.id} style={{
                    display: 'grid',
                    gridTemplateColumns: i % 2 === 0 ? '1.2fr 1fr' : '1fr 1.2fr',
                    gap: 'var(--space-12)',
                    alignItems: 'center',
                    padding: 'var(--space-10)',
                    background: i % 2 === 0 ? 'var(--color-white)' : 'var(--color-ivory-dark)',
                    borderRadius: 'var(--radius-2xl)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ order: i % 2 === 0 ? 0 : 1 }}>
                      <div style={{ position: 'relative', height: '380px', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                        <Image
                          src={room.photos?.[0] ?? (i % 2 === 0 ? '/images/room-suite.jpg' : '/images/bathroom.jpg')}
                          alt={room.name} fill style={{ objectFit: 'cover' }}
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </div>
                    </div>
                    <div style={{ order: i % 2 === 0 ? 1 : 0 }}>
                      <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Guest Room</p>
                      <h2 style={{ marginBottom: 'var(--space-4)' }}>{room.name}</h2>
                      <span className="gold-divider" />
                      {room.description && <p style={{ marginBottom: 'var(--space-6)' }}>{room.description}</p>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                        <span className="badge badge-green">Up to {room.maxOccupancy} guests</span>
                        {room.amenities?.slice(0, 4).map(a => (
                          <span key={a} style={{ fontSize: 'var(--text-xs)', padding: '3px 10px', background: 'var(--color-ivory-dark)', borderRadius: '999px', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{a}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-2xl)', color: 'var(--color-green)', margin: 0 }}>
                          {room.currency} {Number(room.baseRate).toLocaleString()}
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>/night from</span>
                        </p>
                      </div>
                      <Link href="/booking" className="btn btn-primary">Reserve This Room</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section style={{ background: 'var(--color-green)', padding: 'var(--space-16) 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--color-ivory)', marginBottom: 'var(--space-4)' }}>Ready to Book Your Stay?</h2>
            <p style={{ color: 'rgba(250,248,244,0.7)', marginBottom: 'var(--space-8)' }}>Check live availability and book directly for the best rates.</p>
            <Link href="/booking" className="btn btn-primary btn-lg">Check Availability</Link>
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

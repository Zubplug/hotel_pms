import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Explore the beauty of Stanzel Grand Resort in Abuja — our rooms, gardens, restaurant and pool through our photo gallery.',
};

const GALLERY = [
  { src: '/images/hero-entrance.jpg', alt: 'Grand resort entrance at golden hour', caption: 'The Arrival' },
  { src: '/images/lobby.jpg', alt: 'Grand hotel lobby with chandelier', caption: 'The Grand Lobby' },
  { src: '/images/room-suite.jpg', alt: 'Luxury guest suite with garden view', caption: 'Garden Suite' },
  { src: '/images/bathroom.jpg', alt: 'Luxury marble bathroom with soaking tub', caption: 'Private Bathroom' },
  { src: '/images/restaurant.jpg', alt: 'Stanzel restaurant and bar interior', caption: 'The Restaurant' },
  { src: '/images/bar.jpg', alt: 'Stanzel cocktail bar', caption: 'The Bar' },
  { src: '/images/pool-evening.jpg', alt: 'Resort swimming pool at dusk', caption: 'The Pool at Sunset' },
  { src: '/images/aerial.jpg', alt: 'Aerial view of resort grounds', caption: 'Resort Grounds' },
];

export default function GalleryPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <section style={{ paddingTop: 'var(--nav-height)', background: 'var(--color-green)', padding: 'var(--space-20) 0 var(--space-12)' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-3)' }}>Visual Journey</p>
            <h1 style={{ color: 'var(--color-ivory)', marginBottom: 'var(--space-4)' }}>Photo Gallery</h1>
            <span className="gold-divider gold-divider-center" style={{ opacity: 0.4, marginBlock: 'var(--space-5)' }} />
            <p style={{ color: 'rgba(250,248,244,0.65)', maxWidth: 480, margin: '0 auto', fontSize: 'var(--text-lg)' }}>
              A glimpse into life at Stanzel Grand Resort, Abuja.
            </p>
            <p style={{ color: 'rgba(250,248,244,0.35)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-4)', maxWidth: 520, margin: 'var(--space-4) auto 0' }}>
              Images shown are illustrative. Genuine property photography coming soon. Contact us for a property visit.
            </p>
          </div>
        </section>

        <section className="section" style={{ background: 'var(--color-ivory-dark)', paddingTop: 'var(--space-12)' }}>
          <div className="container">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              {GALLERY.map(({ src, alt, caption }, i) => (
                <figure key={i} style={{
                  position: 'relative', margin: 0,
                  borderRadius: 'var(--radius-xl)', overflow: 'hidden',
                  aspectRatio: i === 0 || i === 4 ? '16/10' : '4/3',
                  gridColumn: i === 0 || i === 4 ? 'span 2' : 'span 1',
                  cursor: 'pointer',
                }}>
                  <Image src={src} alt={alt} fill
                    style={{ objectFit: 'cover', transition: 'transform var(--duration-lg) var(--ease)' }}
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <figcaption style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: 'var(--space-4) var(--space-6)',
                    background: 'linear-gradient(to top, rgba(16,38,32,0.8) 0%, transparent 100%)',
                    color: 'var(--color-ivory)',
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 400,
                    transform: 'translateY(100%)',
                    transition: 'transform var(--duration-md) var(--ease)',
                  }} className="gallery-caption">
                    {caption}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 'var(--space-16)' }}>
              <Link href="/booking" className="btn btn-primary btn-lg">Book Your Stay</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <style>{`
        figure:hover img { transform: scale(1.04); }
        figure:hover .gallery-caption { transform: translateY(0) !important; }
        @media (max-width: 640px) {
          figure[style*="span 2"] { grid-column: span 1 !important; aspect-ratio: 4/3 !important; }
        }
      `}</style>
    </>
  );
}

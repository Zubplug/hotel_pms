import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DateSearchWidget } from '@/components/booking/DateSearchWidget';

export const metadata: Metadata = {
  title: 'Book Your Stay',
  description: 'Check room availability and book your stay at Stanzel Grand Resort, Gwarinpa, Abuja. Best rates guaranteed when you book directly.',
};

export default function BookingPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        style={{
          minHeight: '100svh',
          background: 'var(--color-green)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 'var(--nav-height)',
          paddingBottom: 'var(--space-20)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(201,169,110,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center', paddingTop: 'var(--space-12)' }}>
          <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-4)' }}>
            Direct Booking — Best Rates Guaranteed
          </p>
          <h1 style={{
            color: 'var(--color-ivory)',
            fontWeight: 300,
            marginBottom: 'var(--space-3)',
            fontSize: 'clamp(var(--text-4xl), 5vw, var(--text-6xl))',
          }}>
            Plan Your Stay
          </h1>
          <p style={{
            color: 'rgba(250,248,244,0.6)',
            fontSize: 'var(--text-lg)',
            maxWidth: '500px',
            margin: '0 auto var(--space-12)',
          }}>
            Select your dates to see available rooms and live pricing.
          </p>

          {/* Date search widget */}
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <Suspense>
              <DateSearchWidget />
            </Suspense>
          </div>

          {/* Trust signals */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-8)',
            justifyContent: 'center',
            marginTop: 'var(--space-12)',
          }}>
            {[
              { icon: '✓', text: 'Best rate guarantee' },
              { icon: '✓', text: 'No hidden fees' },
              { icon: '✓', text: 'Free cancellation on eligible rates' },
              { icon: '✓', text: 'Instant confirmation' },
            ].map(({ icon, text }) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                fontSize: 'var(--text-sm)', color: 'rgba(250,248,244,0.6)',
              }}>
                <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

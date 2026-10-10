'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function ConfirmationPage() {
  const [confirmation, setConfirmation] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('stanzel_confirmation');
    if (raw) {
      try { setConfirmation(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  if (!confirmation) {
    return (
      <>
        <Header />
        <main style={{ paddingTop: 'var(--nav-height)', minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
          <div className="container" style={{ textAlign: 'center', padding: 'var(--space-24) 0' }}>
            <h1 style={{ marginBottom: 'var(--space-6)' }}>No booking found</h1>
            <Link href="/booking" className="btn btn-primary">Make a Reservation</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const { confirmationNumber, status, paymentRequired, cancellationToken, guest, hold } = confirmation;
  const isConfirmed = status === 'CONFIRMED';

  return (
    <>
      <Header />
      <main id="main-content" style={{ paddingTop: 'var(--nav-height)', background: 'var(--color-ivory-dark)', minHeight: '80vh' }}>
        <div className="container" style={{ maxWidth: '680px', paddingBlock: 'var(--space-16)' }}>

          {/* Success icon */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: isConfirmed ? 'rgba(26,60,52,0.1)' : 'rgba(201,169,110,0.15)',
              border: `3px solid ${isConfirmed ? 'var(--color-green)' : 'var(--color-gold)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-6)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke={isConfirmed ? 'var(--color-green)' : 'var(--color-gold)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-3)' }}>
              {isConfirmed ? 'Booking Confirmed!' : 'Booking Received'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)' }}>
              {isConfirmed
                ? `Thank you, ${guest?.firstName}. Your stay at Stanzel Grand Resort is confirmed.`
                : `Thank you, ${guest?.firstName}. Your booking is pending payment confirmation.`}
            </p>
          </div>

          {/* Confirmation card */}
          <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', border: '1px solid var(--border)', marginBottom: 'var(--space-6)' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-6)', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 'var(--space-2)' }}>Confirmation Number</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-4xl)', color: 'var(--color-green)', fontWeight: 500, letterSpacing: '0.06em' }}>
                {confirmationNumber}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
              {[
                ['Room', hold?.room?.name ?? '—'],
                ['Check-in', hold?.checkIn ?? '—'],
                ['Check-out', hold?.checkOut ?? '—'],
                ['Nights', String(hold?.pricing?.nights ?? '—')],
                ['Guest', `${guest?.firstName} ${guest?.lastName}`],
                ['Email', guest?.email ?? '—'],
                ['Status', isConfirmed ? '✅ Confirmed' : '⏳ Awaiting Payment'],
                ['Total', hold?.pricing ? `${hold.pricing.currency} ${hold.pricing.subtotal.toLocaleString()}` : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</p>
                  <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Email notice */}
          <div style={{ background: 'rgb(26 60 52 / 0.06)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-8)', border: '1px solid rgb(26 60 52 / 0.12)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-green)', lineHeight: 1.7 }}>
              📧 A confirmation email has been sent to <strong>{guest?.email}</strong>. If you don't see it within a few minutes, please check your spam folder.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {cancellationToken && (
              <div style={{ padding: 'var(--space-4)', background: 'var(--color-ivory-dark)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                  Save your cancellation link — you can cancel your booking before arrival if needed.
                </p>
                <Link href={`/manage?token=${cancellationToken}`} style={{ color: 'var(--color-green)', fontSize: 'var(--text-sm)', fontWeight: 600, textDecoration: 'underline' }}>
                  Manage or Cancel Booking →
                </Link>
              </div>
            )}
            <Link href="/" className="btn btn-secondary btn-lg" style={{ textAlign: 'center' }}>
              Return to Homepage
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

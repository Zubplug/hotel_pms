'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HoldTimer } from '@/components/booking/HoldTimer';

export default function ConfirmPage() {
  const router = useRouter();
  const [hold, setHold] = useState<any>(null);
  const [guest, setGuest] = useState<any>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Generate idempotency key once per mount — stable across re-renders/retries
  const idempotencyKey = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36));

  useEffect(() => {
    const rawHold = sessionStorage.getItem('stanzel_hold');
    const rawGuest = sessionStorage.getItem('stanzel_guest');
    if (!rawHold || !rawGuest) { router.replace('/booking'); return; }
    try {
      const parsedHold = JSON.parse(rawHold);
      const parsedGuest = JSON.parse(rawGuest);
      if (new Date(parsedHold.expiresAt) <= new Date()) { setExpired(true); return; }
      setHold(parsedHold); setGuest(parsedGuest);
    } catch { router.replace('/booking'); }
  }, [router]);

  const handleExpired = useCallback(() => setExpired(true), []);

  async function handleConfirm() {
    if (!hold || !guest || expired) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify({
          holdToken: hold.holdToken,
          guest: { firstName: guest.firstName, lastName: guest.lastName, email: guest.email, phone: guest.phone || undefined, country: guest.country || undefined },
          adults: hold.adults, children: hold.children,
          specialRequests: guest.specialRequests || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 410) { setExpired(true); return; }
        if (res.status === 409 && data.error === 'CONFLICT') {
          setError('This room is no longer available. Please search again.'); return;
        }
        setError(data.message ?? 'Could not complete your booking. Please try again.');
        return;
      }

      // Clear session and navigate to confirmation
      sessionStorage.removeItem('stanzel_hold');
      sessionStorage.removeItem('stanzel_guest');
      sessionStorage.setItem('stanzel_confirmation', JSON.stringify({ ...data, guest, hold }));

      if (data.paymentRequired && data.confirmationToken) {
        // Initiate payment intent then redirect to Paystack
        try {
          const piRes = await fetch(`https://lodgecore.vercel.app/api/v1/public/payment/intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': `pi-${idempotencyKey.current}` },
            body: JSON.stringify({ reservationToken: data.confirmationToken, guestEmail: guest.email }),
          });
          const piData = await piRes.json();
          if (piRes.ok && piData.authorizationUrl) {
            window.location.href = piData.authorizationUrl;
            return;
          }
        } catch { /* fall through to confirmation page */ }
      }
      router.push('/booking/confirmation');
    } catch { setError('Network error. Please check your connection and try again.'); }
    finally { setSubmitting(false); }
  }

  if (expired) {
    return (
      <>
        <Header />
        <main style={{ paddingTop: 'var(--nav-height)', minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
          <div className="container" style={{ textAlign: 'center', padding: 'var(--space-24) 0' }}>
            <p style={{ fontSize: 'var(--text-5xl)', marginBottom: 'var(--space-4)' }}>⏰</p>
            <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-4)' }}>Your hold has expired</h1>
            <p style={{ color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto var(--space-8)' }}>
              The inventory hold on your room expired before the booking was completed. Please start a new search.
            </p>
            <Link href="/booking" className="btn btn-primary btn-lg">Search Again</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!hold || !guest) return null;

  const { pricing, room, rate, checkIn, checkOut } = hold;

  return (
    <>
      <Header />
      <main id="main-content" style={{ paddingTop: 'var(--nav-height)', background: 'var(--color-ivory-dark)', minHeight: '80vh' }}>
        <div style={{ background: 'var(--color-green)', padding: 'var(--space-4) 0' }}>
          <div className="container" style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
              {['Search', 'Choose Room', 'Your Details', 'Confirm'].map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-xs)', fontWeight: 700,
                    background: i === 3 ? 'var(--color-gold)' : i < 3 ? 'rgba(201,169,110,0.3)' : 'rgba(250,248,244,0.15)',
                    color: i === 3 ? 'var(--color-green-dark)' : i < 3 ? 'var(--color-gold)' : 'rgba(250,248,244,0.4)',
                  }}>{i < 3 ? '✓' : i + 1}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: i === 3 ? 600 : 400, color: i === 3 ? 'var(--color-ivory)' : 'rgba(250,248,244,0.45)' }}
                    className="step-label">{step}</span>
                </div>
              ))}
            </div>
            <HoldTimer expiresAt={hold.expiresAt} onExpired={handleExpired} />
          </div>
        </div>

        <div className="container" style={{ paddingBlock: 'var(--space-12)', maxWidth: '900px' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>Review Your Booking</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-10)' }}>
            Please confirm all details before completing your reservation.
          </p>

          {/* Room summary */}
          <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr' }}>
              <div style={{ position: 'relative', minHeight: '180px' }}>
                <Image src={room.photos[0] ?? '/images/room-suite.jpg'} alt={room.name} fill style={{ objectFit: 'cover' }} sizes="220px" />
              </div>
              <div style={{ padding: 'var(--space-6)' }}>
                <span className="eyebrow" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Room</span>
                <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>{room.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  {[['Rate Plan', rate.ratePlanName], ['Check-in', checkIn], ['Check-out', checkOut], ['Duration', `${pricing.nights} night${pricing.nights > 1 ? 's' : ''}`]].map(([l, v]) => (
                    <div key={l}>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{l}</p>
                      <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Guest details */}
          <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', border: '1px solid var(--border)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)' }}>Guest Information</h3>
              <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-green)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer', textDecoration: 'underline' }}>
                Edit
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
              {[['Name', `${guest.firstName} ${guest.lastName}`], ['Email', guest.email], ['Phone', guest.phone || '—'], ['Country', guest.country || '—']].map(([l, v]) => (
                <div key={l}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{l}</p>
                  <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{v}</p>
                </div>
              ))}
            </div>
            {guest.specialRequests && (
              <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Special Requests</p>
                <p style={{ fontSize: 'var(--text-sm)' }}>{guest.specialRequests}</p>
              </div>
            )}
          </div>

          {/* Price summary */}
          <div style={{ background: 'var(--color-green)', color: 'var(--color-ivory)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            <h3 style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-5)', fontSize: 'var(--text-xl)' }}>Price Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
              <span style={{ color: 'rgba(250,248,244,0.7)' }}>Room total ({pricing.nights} nights)</span>
              <span>{pricing.currency} {pricing.subtotal.toLocaleString()}</span>
            </div>
            {pricing.depositAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'rgba(250,248,244,0.7)' }}>Deposit due now</span>
                <span style={{ color: 'var(--color-gold)' }}>{pricing.currency} {pricing.depositAmount.toLocaleString()}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(250,248,244,0.15)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Total Amount</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-2xl)', color: 'var(--color-gold)' }}>
                {pricing.currency} {pricing.subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          {error && (
            <div style={{ padding: 'var(--space-4)', background: 'rgb(192 57 43 / 0.08)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(192,57,43,0.2)', marginBottom: 'var(--space-6)' }}>
              <p style={{ color: '#c0392b', fontSize: 'var(--text-sm)' }}>{error}</p>
            </div>
          )}

          <button
            id="complete-booking-btn"
            onClick={handleConfirm}
            disabled={submitting || expired}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', fontSize: 'var(--text-base)' }}
          >
            {submitting ? 'Completing your booking…' : expired ? 'Hold Expired — Search Again' : `Confirm Booking — ${pricing.currency} ${pricing.subtotal.toLocaleString()}`}
          </button>
          <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>
            By confirming, you agree to our Terms & Conditions and cancellation policy.
          </p>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 600px) {
          .container > div > div[style*="grid-template-columns: 220px"] { grid-template-columns: 1fr !important; }
          .step-label { display: none; }
        }
        @media (min-width: 600px) { .step-label { display: block; } }
      `}</style>
    </>
  );
}

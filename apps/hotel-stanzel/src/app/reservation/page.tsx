'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { ConfirmationResponse } from '@/lib/types';

type LocalConfirmation = {
  confirmationNumber: string;
  status: string;
  paymentRequired: boolean;
  cancellationToken?: string;
  guest?: { firstName: string; lastName: string; email: string };
  hold?: { checkIn: string; checkOut: string; pricing: { nights: number; subtotal: number; currency: string }; room?: { name: string } };
};

function money(value: number | string | null | undefined, currency: string) {
  if (value == null) return '—';
  return `${currency} ${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ReservationPaymentResultPage() {
  const [booking, setBooking] = useState<ConfirmationResponse | null>(null);
  const [local, setLocal] = useState<LocalConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Verifying your payment and preparing your confirmation…');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    const saved = sessionStorage.getItem('stanzel_confirmation');
    if (saved) {
      try { setLocal(JSON.parse(saved)); } catch { /* ignore malformed local state */ }
    }
    if (!token) {
      setLoading(false);
      setMessage('Your payment return link is incomplete. Please check your confirmation email.');
      return;
    }

    let attempts = 0;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/confirmation?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? 'Could not verify payment');
        if (cancelled) return;
        setBooking(data);
        setLoading(false);
        if (data.status === 'CONFIRMED') {
          setMessage('Your payment was received and your reservation is confirmed.');
          return;
        }
        attempts += 1;
        if (attempts < 15) {
          setMessage('Payment received. We are waiting for the gateway confirmation…');
          window.setTimeout(load, 2000);
        } else {
          setMessage('Your payment is being verified. Your confirmation email will arrive shortly.');
        }
      } catch (error) {
        if (cancelled) return;
        setLoading(false);
        setMessage(error instanceof Error ? error.message : 'Could not verify payment');
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const confirmed = booking?.status === 'CONFIRMED';
  const guest = booking?.guest ?? local?.guest;
  const room = booking?.roomType ?? local?.hold?.room?.name ?? 'Room reservation';
  const checkIn = booking?.checkIn ?? local?.hold?.checkIn ?? '—';
  const checkOut = booking?.checkOut ?? local?.hold?.checkOut ?? '—';
  const nights = booking?.nights ?? local?.hold?.pricing?.nights ?? 0;
  const currency = booking?.pricing.currency ?? local?.hold?.pricing.currency ?? 'NGN';
  const total = booking?.pricing.subtotal ?? local?.hold?.pricing.subtotal;

  return (
    <>
      <Header />
      <main id="main-content" style={{ paddingTop: 'var(--nav-height)', background: 'var(--color-ivory-dark)', minHeight: '80vh' }}>
        <div className="container" style={{ maxWidth: 760, paddingBlock: 'var(--space-16)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
            <div style={{ width: 82, height: 82, borderRadius: '50%', margin: '0 auto var(--space-6)', display: 'grid', placeItems: 'center', background: confirmed ? 'rgba(26,60,52,.1)' : 'rgba(201,169,110,.15)', border: `3px solid ${confirmed ? 'var(--color-green)' : 'var(--color-gold)'}` }}>
              {loading ? <span style={{ fontSize: 30 }}>⋯</span> : <span style={{ fontSize: 34 }}>{confirmed ? '✓' : '⏳'}</span>}
            </div>
            <p style={{ color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 12, fontWeight: 700 }}>Stanzel Grand Resort</p>
            <h1 style={{ fontSize: 'var(--text-4xl)', margin: 'var(--space-3) 0' }}>{confirmed ? 'Payment successful' : 'Payment received'}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)' }}>{message}</p>
          </div>

          <section style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: 'var(--space-8)', background: 'var(--color-green)', color: '#fff', display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div><p style={{ opacity: .72, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em' }}>Booking reference</p><p style={{ fontFamily: 'var(--font-serif)', fontSize: 30, letterSpacing: '.06em', marginTop: 5 }}>{booking?.confirmationNumber ?? local?.confirmationNumber ?? 'Processing'}</p></div>
              <span style={{ padding: '8px 13px', borderRadius: 999, background: confirmed ? 'rgba(255,255,255,.16)' : 'rgba(201,169,110,.22)', fontSize: 12, fontWeight: 700 }}>{confirmed ? 'CONFIRMED' : 'PAYMENT VERIFYING'}</span>
            </div>
            <div style={{ padding: 'var(--space-8)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-6)' }}>
                {[["Guest", guest ? `${guest.firstName} ${guest.lastName}` : '—'], ['Email', guest?.email ?? '—'], ['Room', room], ['Check-in', checkIn], ['Check-out', checkOut], ['Nights', String(nights)], ['Guests', booking ? `${booking.adults} adult(s), ${booking.children} child(ren)` : '—'], ['Total', money(total, currency)]].map(([label, value]) => <div key={label}><p style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</p><p style={{ fontWeight: 650, fontSize: 15 }}>{value}</p></div>)}
              </div>
            </div>
          </section>

          <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', background: 'rgba(26,60,52,.06)', border: '1px solid rgba(26,60,52,.12)', color: 'var(--color-green)', lineHeight: 1.7, fontSize: 14 }}>
            A confirmation and payment receipt will be sent to <strong>{guest?.email ?? 'your email address'}</strong>. Please keep your booking reference for check-in.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 'var(--space-8)' }}>
            {local?.cancellationToken && <Link href={`/manage?token=${local.cancellationToken}`} className="btn btn-outline">Manage booking</Link>}
            <Link href="/" className="btn btn-primary">Return to homepage</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

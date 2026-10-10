'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HoldTimer } from '@/components/booking/HoldTimer';

interface HoldSession {
  holdToken: string;
  expiresAt: string;
  pricing: { nights: number; currency: string; subtotal: number; depositAmount: number; depositType: string | null };
  room: { id: string; name: string; photos: string[] };
  rate: { ratePlanName: string };
  checkIn: string; checkOut: string; adults: number; children: number;
}

export default function GuestDetailsPage() {
  const router = useRouter();
  const [hold, setHold] = useState<HoldSession | null>(null);
  const [expired, setExpired] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', country: '', specialRequests: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = sessionStorage.getItem('stanzel_hold');
    if (!raw) { router.replace('/booking'); return; }
    try {
      const parsed: HoldSession = JSON.parse(raw);
      if (new Date(parsed.expiresAt) <= new Date()) { setExpired(true); return; }
      setHold(parsed);
    } catch { router.replace('/booking'); }
  }, [router]);

  const handleExpired = useCallback(() => setExpired(true), []);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'A valid email address is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !hold) return;
    // Store guest form in session and navigate to confirm
    sessionStorage.setItem('stanzel_guest', JSON.stringify(form));
    router.push('/booking/confirm');
  }

  function field(id: keyof typeof form, label: string, type = 'text', required = false) {
    return (
      <div className="field">
        <label htmlFor={`guest-${id}`} className="field-label">
          {label}{required && <span style={{ color: 'var(--color-gold)' }}> *</span>}
        </label>
        {id === 'specialRequests' ? (
          <textarea
            id={`guest-${id}`}
            value={form[id]}
            onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
            className={`field-input ${errors[id] ? 'error' : ''}`}
            rows={3}
            maxLength={2000}
            placeholder="Dietary requirements, accessibility needs, celebration details…"
            style={{ resize: 'vertical' }}
          />
        ) : (
          <input
            id={`guest-${id}`}
            type={type}
            value={form[id]}
            onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
            className={`field-input ${errors[id] ? 'error' : ''}`}
            required={required}
            autoComplete={id === 'email' ? 'email' : id === 'phone' ? 'tel' : id === 'firstName' ? 'given-name' : id === 'lastName' ? 'family-name' : undefined}
          />
        )}
        {errors[id] && <p className="field-error">{errors[id]}</p>}
      </div>
    );
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
              The 12-minute inventory hold on your room has expired. Please search again to check current availability.
            </p>
            <Link href="/booking" className="btn btn-primary btn-lg">Search Again</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!hold) return null;

  const { pricing, room, rate, checkIn, checkOut } = hold;

  return (
    <>
      <Header />
      <main id="main-content" style={{ paddingTop: 'var(--nav-height)', background: 'var(--color-ivory-dark)', minHeight: '80vh' }}>
        {/* Steps bar */}
        <div style={{ background: 'var(--color-green)', padding: 'var(--space-4) 0' }}>
          <div className="container" style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
              {['Search', 'Choose Room', 'Your Details', 'Confirm'].map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-xs)', fontWeight: 700,
                    background: i === 2 ? 'var(--color-gold)' : i < 2 ? 'rgba(201,169,110,0.3)' : 'rgba(250,248,244,0.15)',
                    color: i === 2 ? 'var(--color-green-dark)' : i < 2 ? 'var(--color-gold)' : 'rgba(250,248,244,0.4)',
                  }}>{i < 2 ? '✓' : i + 1}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: i === 2 ? 600 : 400, color: i === 2 ? 'var(--color-ivory)' : 'rgba(250,248,244,0.45)' }}
                    className="step-label">{step}</span>
                </div>
              ))}
            </div>
            <HoldTimer expiresAt={hold.expiresAt} onExpired={handleExpired} />
          </div>
        </div>

        <div className="container" style={{ paddingBlock: 'var(--space-12)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 'var(--space-10)', alignItems: 'start' }}>
            {/* Form */}
            <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-10)', border: '1px solid var(--border)' }}>
              <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>Your Details</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>
                Please provide the primary guest's information. Your confirmation will be sent to the email address below.
              </p>
              <form id="guest-details-form" onSubmit={handleSubmit} noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                  {field('firstName', 'First Name', 'text', true)}
                  {field('lastName', 'Last Name', 'text', true)}
                </div>
                <div style={{ marginBottom: 'var(--space-5)' }}>{field('email', 'Email Address', 'email', true)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                  {field('phone', 'Phone Number', 'tel')}
                  <div className="field">
                    <label htmlFor="guest-country" className="field-label">Country</label>
                    <input id="guest-country" type="text" className="field-input"
                      value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                      placeholder="Nigeria" autoComplete="country-name" />
                  </div>
                </div>
                <div style={{ marginBottom: 'var(--space-8)' }}>{field('specialRequests', 'Special Requests (optional)')}</div>

                <div style={{ padding: 'var(--space-5)', background: 'var(--color-ivory-dark)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-8)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  🔒 Your information is used solely to process your booking. We do not share it with third parties. See our Privacy Policy.
                </div>

                <button type="submit" id="proceed-to-confirm-btn" className="btn btn-primary btn-lg" style={{ width: '100%' }}
                  disabled={expired}>
                  {expired ? 'Hold Expired' : 'Continue to Review →'}
                </button>
              </form>
            </div>

            {/* Booking summary sidebar */}
            <div style={{ position: 'sticky', top: 'calc(var(--nav-height) + var(--space-6))' }}>
              <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', height: '180px' }}>
                  <Image src={room.photos[0] ?? '/images/room-suite.jpg'} alt={room.name} fill style={{ objectFit: 'cover' }} sizes="400px" />
                </div>
                <div style={{ padding: 'var(--space-6)' }}>
                  <span className="eyebrow" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Your Selection</span>
                  <h3 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-4)' }}>{room.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                    {[['Rate Plan', rate.ratePlanName], ['Check-in', checkIn], ['Check-out', checkOut], ['Nights', String(pricing.nights)]].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                        <span style={{ fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontWeight: 600 }}>Total</span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', color: 'var(--color-green)', fontWeight: 500 }}>
                        {pricing.currency} {pricing.subtotal.toLocaleString()}
                      </span>
                    </div>
                    {pricing.depositAmount > 0 && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        Deposit due now: {pricing.currency} {pricing.depositAmount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <style>{`
        @media (max-width: 768px) {
          .container > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .step-label { display: none; }
        }
        @media (min-width: 600px) { .step-label { display: block; } }
      `}</style>
    </>
  );
}

'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { AvailabilityResponse, LCAvailableRoomType, LCRatePricing } from '@/lib/types';

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function RoomCard({ room, checkIn, checkOut, adults, children }: {
  room: LCAvailableRoomType;
  checkIn: string; checkOut: string; adults: number; children: number;
}) {
  const router = useRouter();
  const [selectedRate, setSelectedRate] = useState<LCRatePricing | null>(room.rates[0] ?? null);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState('');

  async function handleSelect() {
    if (!selectedRate) return;
    setHolding(true); setError('');
    try {
      const res = await fetch('/api/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomTypeId: room.roomTypeId, ratePlanId: selectedRate.ratePlanId, checkIn, checkOut }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Could not reserve room. Please try again.'); return; }
      // Pass hold data to guest-details step via session storage
      sessionStorage.setItem('stanzel_hold', JSON.stringify({
        holdToken: data.holdToken,
        expiresAt: data.expiresAt,
        pricing: data.pricing,
        room: { id: room.roomTypeId, name: room.name, photos: room.photos },
        rate: selectedRate,
        checkIn, checkOut, adults, children,
      }));
      router.push('/booking/guest');
    } catch { setError('Network error. Please try again.'); }
    finally { setHolding(false); }
  }

  return (
    <article style={{
      background: 'var(--color-white)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)', transition: 'box-shadow var(--duration-md) var(--ease)',
    }}>
      {/* Room image */}
      <div style={{ position: 'relative', height: '240px', overflow: 'hidden' }}>
        <Image
          src={room.photos[0] ?? '/images/room-suite.jpg'}
          alt={room.name} fill
          style={{ objectFit: 'cover' }}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {!room.availability.isAvailable && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 'var(--text-lg)', letterSpacing: '0.1em' }}>
              SOLD OUT
            </span>
          </div>
        )}
        <div style={{ position: 'absolute', top: 'var(--space-4)', left: 'var(--space-4)' }}>
          <span className="badge badge-green">Up to {room.maxOccupancy} guests</span>
        </div>
      </div>

      <div style={{ padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>{room.name}</h2>
        {room.description && (
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {room.description}
          </p>
        )}
        {room.amenities.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
            {room.amenities.slice(0, 5).map(a => (
              <span key={a} style={{ fontSize: 'var(--text-xs)', padding: '3px 10px', background: 'var(--color-ivory-dark)', borderRadius: '999px', color: 'var(--text-muted)' }}>{a}</span>
            ))}
          </div>
        )}

        {/* Rate plan selector */}
        {room.rates.length > 1 && (
          <div className="field" style={{ marginBottom: 'var(--space-5)' }}>
            <label htmlFor={`rate-${room.roomTypeId}`} className="field-label">Rate Plan</label>
            <select id={`rate-${room.roomTypeId}`} className="field-input"
              onChange={e => setSelectedRate(room.rates.find(r => r.ratePlanId === e.target.value) ?? null)}>
              {room.rates.map(r => (
                <option key={r.ratePlanId} value={r.ratePlanId}>{r.ratePlanName} — {formatCurrency(r.subtotal, r.currency)}</option>
              ))}
            </select>
          </div>
        )}

        {selectedRate && (
          <div className="room-price-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-2xl)', color: 'var(--color-green)', margin: 0, lineHeight: 1 }}>
                {formatCurrency(selectedRate.subtotal, selectedRate.currency)}
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                {selectedRate.nights} nights · {formatCurrency(selectedRate.avgNightlyRate, selectedRate.currency)}/night
                {selectedRate.depositAmount > 0 && ` · Deposit: ${formatCurrency(selectedRate.depositAmount, selectedRate.currency)}`}
              </p>
            </div>
            {room.availability.isAvailable ? (
              <button onClick={handleSelect} disabled={holding}
                className="btn btn-primary"
                style={{ minWidth: '140px' }}>
                {holding ? 'Reserving…' : 'Select Room'}
              </button>
            ) : (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Not available</span>
            )}
          </div>
        )}
        {error && <p style={{ color: '#c0392b', fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' }}>{error}</p>}
      </div>
    </article>
  );
}

function RoomsPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const checkIn = params.get('checkIn') ?? '';
  const checkOut = params.get('checkOut') ?? '';
  const adults = Number(params.get('adults') ?? 2);
  const children = Number(params.get('children') ?? 0);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAvailability = useCallback(async () => {
    if (!checkIn || !checkOut) { setError('Please go back and select your dates.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkIn, checkOut, adults, children }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Could not load availability.'); return; }
      setAvailability(data);
    } catch { setError('Network error — please check your connection and try again.'); }
    finally { setLoading(false); }
  }, [checkIn, checkOut, adults, children]);

  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  const nights = availability?.nights ?? 0;
  const availableRooms = availability?.data.filter(r => r.availability.isAvailable) ?? [];
  const unavailableRooms = availability?.data.filter(r => !r.availability.isAvailable) ?? [];

  return (
    <>
      <Header />
      <main id="main-content" style={{ paddingTop: 'var(--nav-height)', minHeight: '80vh' }}>
        {/* Steps bar */}
        <div style={{ background: 'var(--color-green)', padding: 'var(--space-4) 0' }}>
          <div className="container">
            <div className="booking-steps" style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
            {['Search', 'Choose Room', 'Your Details', 'Confirm'].map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--text-xs)', fontWeight: 700,
                  background: i === 1 ? 'var(--color-gold)' : 'rgba(250,248,244,0.15)',
                  color: i === 1 ? 'var(--color-green-dark)' : 'rgba(250,248,244,0.5)',
                }}>{i + 1}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: i === 1 ? 600 : 400, color: i === 1 ? 'var(--color-ivory)' : 'rgba(250,248,244,0.45)', display: 'none' }}
                  className="step-label">{step}</span>
              </div>
            ))}
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingBlock: 'var(--space-12)' }}>
          {/* Summary strip */}
          {checkIn && checkOut && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)',
              alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 'var(--space-10)',
              padding: 'var(--space-5) var(--space-6)',
              background: 'var(--color-ivory-dark)', borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
                {[['Check-in', checkIn], ['Check-out', checkOut], ['Nights', String(nights || '—')], ['Guests', `${adults} adult${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}`]].map(([label, val]) => (
                  <div key={label}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</p>
                    <p style={{ fontWeight: 600, color: 'var(--color-green)', fontSize: 'var(--text-sm)' }}>{val}</p>
                  </div>
                ))}
              </div>
              <Link href="/booking" className="btn btn-outline-dark btn-sm">Modify Search</Link>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-20)' }}>
              <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--color-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--space-4)' }} />
              <p style={{ color: 'var(--text-muted)' }}>Checking availability…</p>
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
              <p style={{ color: '#c0392b', marginBottom: 'var(--space-6)' }}>{error}</p>
              <button onClick={fetchAvailability} className="btn btn-secondary">Try Again</button>
            </div>
          )}

          {!loading && !error && availability && (
            <>
              <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>
                {availableRooms.length > 0 ? `${availableRooms.length} Room${availableRooms.length > 1 ? 's' : ''} Available` : 'No Rooms Available'}
              </h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-10)' }}>
                {availableRooms.length > 0 ? 'Select your preferred room and rate plan to continue.' : 'No rooms match your criteria. Try different dates or occupancy.'}
              </p>

              {availableRooms.length === 0 && (
                <div style={{ textAlign: 'center', padding: 'var(--space-16)', background: 'var(--color-ivory-dark)', borderRadius: 'var(--radius-xl)' }}>
                  <p style={{ fontSize: 'var(--text-5xl)', marginBottom: 'var(--space-4)' }}>🏨</p>
                  <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>No availability for these dates</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-8)', maxWidth: 480, margin: '0 auto var(--space-8)' }}>
                    Please try different dates or contact us directly and we'll do our best to accommodate you.
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/booking" className="btn btn-secondary">Change Dates</Link>
                    <Link href="/contact" className="btn btn-outline-dark">Contact Us</Link>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-8)' }}>
                {availableRooms.map(room => (
                  <RoomCard key={room.roomTypeId} room={room} checkIn={checkIn} checkOut={checkOut} adults={adults} children={children} />
                ))}
              </div>

              {unavailableRooms.length > 0 && availableRooms.length > 0 && (
                <div style={{ marginTop: 'var(--space-12)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-6)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Also at Stanzel Grand Resort — Currently Unavailable
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-8)', opacity: 0.6 }}>
                    {unavailableRooms.map(room => (
                      <RoomCard key={room.roomTypeId} room={room} checkIn={checkIn} checkOut={checkOut} adults={adults} children={children} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 600px) { .step-label { display: block !important; } }
      `}</style>
    </>
  );
}

export default function BookingRoomsPage() {
  return (
    <Suspense fallback={
      <div style={{ paddingTop: 'calc(var(--nav-height) + 4rem)', textAlign: 'center', minHeight: '60vh' }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--color-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--space-4)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading availability…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <RoomsPageContent />
    </Suspense>
  );
}

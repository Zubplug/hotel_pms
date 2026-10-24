'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Guest = { firstName: string; lastName: string; email: string; phone: string };
type Room = { id: string; name: string; availability: { available: number; isAvailable: boolean }; rate: { currency: string; subtotal: number } | null };

const emptyGuest = (): Guest => ({ firstName: '', lastName: '', email: '', phone: '' });

export default function CorporateBookPage() {
  const router = useRouter();
  const [form, setForm] = useState({ checkIn: '', checkOut: '', adults: '1', children: '0', roomCount: '1', paymentMode: 'PAY_LATER' });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [guests, setGuests] = useState<Guest[]>([emptyGuest()]);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const roomCount = Math.max(1, Math.min(20, Number(form.roomCount) || 1));

  const update = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'roomCount') {
      const count = Math.max(1, Math.min(20, Number(value) || 1));
      setGuests((current) => Array.from({ length: count }, (_, index) => current[index] || emptyGuest()));
      setQuote(null);
    }
  };
  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomTypeId), [rooms, roomTypeId]);
  const updateGuest = (index: number, key: keyof Guest, value: string) => setGuests((current) => current.map((guest, guestIndex) => guestIndex === index ? { ...guest, [key]: value } : guest));

  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setQuote(null);
    try {
      const response = await fetch(`/api/corporate/availability?${new URLSearchParams(form)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Availability unavailable.');
      const available = body.rooms || [];
      setRooms(available);
      setRoomTypeId(available.find((room: Room) => room.rate && room.availability.isAvailable)?.id || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not search availability.'); }
    finally { setBusy(false); }
  }

  async function requestQuote() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/corporate/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomTypeId, checkIn: form.checkIn, checkOut: form.checkOut, adults: Number(form.adults), children: Number(form.children), roomCount, paymentMode: form.paymentMode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Corporate rate unavailable.');
      setQuote(body);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create quote.'); }
    finally { setBusy(false); }
  }

  async function book() {
    if (!quote?.quoteId || guests.length !== roomCount) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/corporate/booking', { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ quoteId: quote.quoteId, guests, specialRequests: 'Corporate portal booking' }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not create reservation.');
      if (body.paymentRequired && body.reservationId) {
        const payment = await fetch(`/api/corporate/payment?reservationId=${encodeURIComponent(body.reservationId)}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': `payment-${crypto.randomUUID()}` }, body: JSON.stringify({ email: guests[0].email }) });
        const paymentBody = await payment.json();
        if (!payment.ok) throw new Error(paymentBody.error || 'Could not initialize payment.');
        if (paymentBody.authorizationUrl) { window.location.href = paymentBody.authorizationUrl; return; }
      }
      router.push('/corporate/reservations');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete reservation.'); }
    finally { setBusy(false); }
  }

  return <section className="card">
    <p className="eyebrow">Corporate booking</p>
    <h2>Reserve rooms for your organisation</h2>
    <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>The LodgeCore Corporate API validates Stanzel availability and approved corporate rates, then creates standard PMS reservations for Front Desk check-in.</p>
    <form onSubmit={search} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 22 }}>
      <label className="field-label">Check-in<input className="field-input" type="date" required value={form.checkIn} onChange={(e) => update('checkIn', e.target.value)} /></label>
      <label className="field-label">Check-out<input className="field-input" type="date" required value={form.checkOut} onChange={(e) => update('checkOut', e.target.value)} /></label>
      <label className="field-label">Payment<select className="field-input" value={form.paymentMode} onChange={(e) => update('paymentMode', e.target.value)}><option value="PAY_LATER">Pay later — approval required</option><option value="FULL">Prepaid in full</option><option value="DEPOSIT">Deposit</option></select></label>
      <label className="field-label">Adults per room<input className="field-input" type="number" min="1" value={form.adults} onChange={(e) => update('adults', e.target.value)} /></label>
      <label className="field-label">Children per room<input className="field-input" type="number" min="0" value={form.children} onChange={(e) => update('children', e.target.value)} /></label>
      <label className="field-label">Rooms<input className="field-input" type="number" min="1" max="20" value={form.roomCount} onChange={(e) => update('roomCount', e.target.value)} /></label>
      <button className="btn btn-primary" disabled={busy} style={{ gridColumn: '1 / -1' }}>{busy ? 'Checking…' : 'Check corporate availability'}</button>
    </form>
    {rooms.length > 0 && <div style={{ marginTop: 25, display: 'grid', gap: 12 }}>
      {rooms.map((room) => <label key={room.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: 16, border: `1px solid ${roomTypeId === room.id ? 'var(--color-green)' : 'var(--border)'}`, borderRadius: 12, opacity: room.rate && room.availability.isAvailable ? 1 : .5 }}><span><input type="radio" disabled={!room.rate || !room.availability.isAvailable} checked={roomTypeId === room.id} onChange={() => setRoomTypeId(room.id)} /> <strong style={{ marginLeft: 8 }}>{room.name}</strong><small style={{ display: 'block', margin: '6px 0 0 22px', color: 'var(--text-muted)' }}>{room.availability.available} available</small></span><strong>{room.rate ? `${room.rate.currency} ${Number(room.rate.subtotal).toLocaleString()}` : 'Unavailable'}</strong></label>)}
      <button className="btn btn-outline-dark" disabled={!roomTypeId || !selectedRoom || busy} onClick={requestQuote}>Review corporate quote</button>
    </div>}
    {quote && <div style={{ marginTop: 25, padding: 20, background: 'var(--color-ivory-dark)', borderRadius: 14 }}><h3>Quote ready</h3><p style={{ color: 'var(--text-muted)' }}>Total: <strong>{quote.snapshot?.totals?.currency} {Number(quote.snapshot?.totals?.total || 0).toLocaleString()}</strong>. Expires {new Date(quote.expiresAt).toLocaleString()}.</p><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Enter one guest per room. Physical rooms are assigned by Front Desk at arrival.</p><div style={{ display: 'grid', gap: 18, marginTop: 15 }}>{guests.map((guest, index) => <fieldset key={index} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}><legend>Room {index + 1} guest</legend><input required className="field-input" placeholder="First name" value={guest.firstName} onChange={(e) => updateGuest(index, 'firstName', e.target.value)} /><input required className="field-input" placeholder="Last name" value={guest.lastName} onChange={(e) => updateGuest(index, 'lastName', e.target.value)} /><input required className="field-input" type="email" placeholder="Email" value={guest.email} onChange={(e) => updateGuest(index, 'email', e.target.value)} /><input className="field-input" placeholder="Phone" value={guest.phone} onChange={(e) => updateGuest(index, 'phone', e.target.value)} /></fieldset>)}<button className="btn btn-primary" disabled={busy || guests.some((guest) => !guest.firstName || !guest.lastName || !guest.email)} onClick={book}>{busy ? 'Creating reservation…' : 'Create corporate reservation'}</button></div></div>}
    {error && <p style={{ color: '#b42318', marginTop: 16 }}>{error}</p>}
  </section>;
}

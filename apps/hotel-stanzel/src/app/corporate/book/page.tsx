'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Guest = { firstName: string; lastName: string; email: string; phone: string };
type Room = {
  id: string;
  name: string;
  description?: string | null;
  photos?: string[];
  amenities?: string[];
  availability: { available: number; isAvailable: boolean };
  rate: { currency: string; subtotal?: number; nightlyRate?: number; baseNightlyRate?: number } | null;
};

const emptyGuest = (): Guest => ({ firstName: '', lastName: '', email: '', phone: '' });
const paymentOptions = [
  { value: 'PAY_LATER', label: 'Pay later', description: 'Use your approved corporate terms' },
  { value: 'FULL', label: 'Pay in full', description: 'Settle the reservation before arrival' },
  { value: 'DEPOSIT', label: 'Pay a deposit', description: 'Pay the configured minimum deposit' },
];

function money(value: unknown, currency = 'NGN') {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value: string) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86400000));
}

export default function CorporateBookPage() {
  const router = useRouter();
  const [form, setForm] = useState({ checkIn: '', checkOut: '', adults: '2', children: '0', roomCount: '1', paymentMode: 'PAY_LATER' });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypeId, setRoomTypeId] = useState('');
  const [guests, setGuests] = useState<Guest[]>([emptyGuest()]);
  const [quote, setQuote] = useState<any>(null);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const nights = nightsBetween(form.checkIn, form.checkOut);
  const roomCount = Math.max(1, Math.min(20, Number(form.roomCount) || 1));
  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomTypeId), [rooms, roomTypeId]);
  const selectedPayment = paymentOptions.find((option) => option.value === form.paymentMode) || paymentOptions[0];

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'roomCount') {
      const count = Math.max(1, Math.min(20, Number(value) || 1));
      setGuests((current) => Array.from({ length: count }, (_, index) => current[index] || emptyGuest()));
      setQuote(null);
    }
    if (key === 'checkIn' || key === 'checkOut' || key === 'paymentMode') setQuote(null);
  }

  function updateGuest(index: number, key: keyof Guest, value: string) {
    setGuests((current) => current.map((guest, guestIndex) => guestIndex === index ? { ...guest, [key]: value } : guest));
  }

  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setQuote(null);
    try {
      const response = await fetch(`/api/corporate/availability?${new URLSearchParams(form)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Availability unavailable.');
      const available = body.rooms || [];
      setRooms(available);
      setRoomTypeId(available.find((room: Room) => room.rate && room.availability.isAvailable)?.id || '');
      setStage(2);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not search availability.'); }
    finally { setBusy(false); }
  }

  async function requestQuote() {
    if (!roomTypeId) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/corporate/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomTypeId, checkIn: form.checkIn, checkOut: form.checkOut, adults: Number(form.adults), children: Number(form.children), roomCount, paymentMode: form.paymentMode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Corporate rate unavailable.');
      setQuote(body);
      setStage(3);
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

  const quoteTotal = quote?.snapshot?.totals?.total || quote?.snapshot?.total || 0;
  const quoteCurrency = quote?.snapshot?.totals?.currency || selectedRoom?.rate?.currency || 'NGN';

  return <div className="booking-workspace">
    <section className="booking-intro"><div><span className="booking-kicker">Corporate reservations</span><h2>Arrange a stay for your team</h2><p>Find live availability, apply your approved corporate rate, and create a PMS-connected reservation in a few simple steps.</p></div><div className="booking-assurance"><span>✓ Live availability</span><span>✓ Contract pricing</span><span>✓ Front Desk ready</span></div></section>
    <nav className="booking-progress" aria-label="Booking progress"><span className={stage >= 1 ? 'is-active' : ''}><b>1</b> Stay details</span><i /><span className={stage >= 2 ? 'is-active' : ''}><b>2</b> Choose room</span><i /><span className={stage >= 3 ? 'is-active' : ''}><b>3</b> Review & reserve</span></nav>
    <div className="booking-layout"><div className="booking-main">

    {stage === 1 && <section className="booking-card booking-search-card"><div className="booking-card-heading"><div><span className="booking-section-kicker">Step 1 · Stay details</span><h3>When is your team staying?</h3><p>Rates and availability are calculated from your selected dates, occupancy, room count, and payment arrangement.</p></div><span className="booking-step-count">01 / 03</span></div><form className="booking-form" onSubmit={search}><label className="booking-field booking-field-date"><span>Check-in</span><input type="date" required value={form.checkIn} onChange={(event) => update('checkIn', event.target.value)} /><small>{form.checkIn ? dateLabel(form.checkIn) : 'Select arrival date'}</small></label><label className="booking-field booking-field-date"><span>Check-out</span><input type="date" required value={form.checkOut} min={form.checkIn || undefined} onChange={(event) => update('checkOut', event.target.value)} /><small>{nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Select departure date'}</small></label><label className="booking-field"><span>Adults per room</span><input type="number" min="1" max="20" required value={form.adults} onChange={(event) => update('adults', event.target.value)} /><small>Guests aged 13+</small></label><label className="booking-field"><span>Children per room</span><input type="number" min="0" max="20" required value={form.children} onChange={(event) => update('children', event.target.value)} /><small>Guests aged 0–12</small></label><div className="booking-payment-field"><span>Payment arrangement</span><div className="booking-payment-options">{paymentOptions.map((option) => <button type="button" key={option.value} className={form.paymentMode === option.value ? 'is-selected' : ''} onClick={() => update('paymentMode', option.value)}><span className="booking-radio" /><span><strong>{option.label}</strong><small>{option.description}</small></span></button>)}</div></div><div className="booking-form-footer"><span className="booking-form-note"><b>i</b> Your corporate rate is applied before the quote is created.</span><button className="booking-primary-button" disabled={busy}>{busy ? 'Checking availability…' : <>Check availability <span>→</span></>}</button></div></form></section>}

    {stage === 2 && rooms.length > 0 && <section className="booking-card booking-room-card"><div className="booking-card-heading"><div><span className="booking-section-kicker">Step 2 · Choose rooms</span><h3>Select the best fit for your team</h3><p>Rates shown are per room for the selected stay. Your corporate adjustments are reflected in the nightly rate.</p></div><span className="booking-step-count">02 / 03</span></div><div className="booking-stay-summary"><span>Stay <strong>{dateLabel(form.checkIn)} — {dateLabel(form.checkOut)}</strong></span><span><strong>{nights}</strong> night{nights === 1 ? '' : 's'}</span><label className="booking-room-count-control"><span>Rooms</span><input type="number" min="1" max="20" value={form.roomCount} onChange={(event) => update('roomCount', event.target.value)} /></label><span>{selectedPayment.label}</span></div><div className="booking-room-list">{rooms.map((room) => { const available = room.rate && room.availability.isAvailable; const selected = room.id === roomTypeId; const image = room.photos?.[0] || '/images/room-suite.jpg'; return <button type="button" className={`booking-room-option${selected ? ' is-selected' : ''}${!available ? ' is-unavailable' : ''}`} disabled={!available} key={room.id} onClick={() => { setRoomTypeId(room.id); setQuote(null); }}><span className="booking-room-image"><img src={image} alt="" /><span>{available ? `${room.availability.available} available` : 'Unavailable'}</span></span><span className="booking-room-details"><span className="booking-room-top"><span><strong>{room.name}</strong><small>{room.description || 'Comfortable accommodation for business travel.'}</small></span><span className="booking-room-price"><strong>{room.rate ? money(room.rate.nightlyRate || room.rate.subtotal, room.rate.currency) : '—'}</strong><small>per room / night</small></span></span><span className="booking-room-tags">{(room.amenities || ['Wi-Fi', 'Breakfast available']).slice(0, 3).map((amenity) => <em key={amenity}>{amenity}</em>)}</span><span className="booking-room-bottom"><span>{selected ? 'Selected for your quote' : available ? 'Select this room type' : 'Not available for these dates'}</span><span className="booking-select-mark">{selected ? '✓' : '○'}</span></span></span></button>; })}</div><div className="booking-room-footer"><button type="button" className="booking-back-button" onClick={() => setStage(1)}>← Edit stay details</button><span>{selectedRoom ? <><strong>{selectedRoom.name}</strong> selected · {roomCount} room{roomCount === 1 ? '' : 's'}</> : 'Choose an available room type to continue.'}</span><button type="button" className="booking-secondary-button" disabled={!roomTypeId || busy} onClick={requestQuote}>{busy ? 'Preparing quote…' : 'Review corporate quote →'}</button></div></section>}

    {stage === 3 && quote && <section className="booking-card booking-review-card"><div className="booking-card-heading"><div><span className="booking-section-kicker">Step 3 · Review & reserve</span><h3>Your corporate reservation summary</h3><p>Review the rate, stay details, and guest information before creating the reservation.</p></div><span className="booking-step-count">03 / 03</span></div><div className="booking-review-layout"><div className="booking-summary-panel"><div className="booking-summary-title"><span>Reservation summary</span><em>Quote expires {quote.expiresAt ? new Date(quote.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'soon'}</em></div><div className="booking-summary-room"><span className="booking-summary-room-icon">⌂</span><span><strong>{selectedRoom?.name || 'Selected room'}</strong><small>{dateLabel(form.checkIn)} — {dateLabel(form.checkOut)} · {nights} night{nights === 1 ? '' : 's'}</small></span></div><div className="booking-summary-lines"><div><span>Guests</span><strong>{form.adults} adult{Number(form.adults) === 1 ? '' : 's'}{Number(form.children) ? `, ${form.children} child${Number(form.children) === 1 ? '' : 'ren'}` : ''}</strong></div><div><span>Rooms</span><strong>{roomCount}</strong></div><div><span>Payment</span><strong>{selectedPayment.label}</strong></div><div className="booking-summary-total"><span>Estimated total</span><strong>{money(quoteTotal, quoteCurrency)}</strong></div></div><p className="booking-summary-note">The final reservation will use the quoted corporate rate and remain linked to your company account.</p></div><div className="booking-guests-panel"><div className="booking-summary-title"><span>Guest details</span><em>{guests.length} room{guests.length === 1 ? '' : 's'}</em></div><p className="booking-guest-intro">Add one primary guest for each room. These details can also be completed later from Reservations.</p><div className="booking-guest-list">{guests.map((guest, index) => <fieldset className="booking-guest-card" key={index}><legend>Room {index + 1}</legend><div className="booking-guest-fields"><input required placeholder="First name" value={guest.firstName} onChange={(event) => updateGuest(index, 'firstName', event.target.value)} /><input required placeholder="Last name" value={guest.lastName} onChange={(event) => updateGuest(index, 'lastName', event.target.value)} /><input required type="email" placeholder="Email address" value={guest.email} onChange={(event) => updateGuest(index, 'email', event.target.value)} /><input placeholder="Phone (optional)" value={guest.phone} onChange={(event) => updateGuest(index, 'phone', event.target.value)} /></div></fieldset>)}</div></div></div><div className="booking-review-footer"><button type="button" className="booking-back-button" onClick={() => setStage(2)}>← Change room</button><span><b>✓</b> Secure PMS-connected reservation</span><button type="button" className="booking-primary-button" disabled={busy || guests.some((guest) => !guest.firstName || !guest.lastName || !guest.email)} onClick={book}>{busy ? 'Creating reservation…' : 'Confirm corporate reservation →'}</button></div></section>}
    {error && <div className="booking-error"><strong>We could not complete that step</strong><span>{error}</span></div>}
    </div><aside className="booking-sidebar"><div className="booking-sidebar-heading"><span>YOUR STAY</span><strong>Reservation details</strong></div><div className="booking-sidebar-card"><div className="booking-sidebar-row"><span>Check-in</span><strong>{dateLabel(form.checkIn)}</strong></div><div className="booking-sidebar-row"><span>Check-out</span><strong>{dateLabel(form.checkOut)}</strong></div><div className="booking-sidebar-row"><span>Length</span><strong>{nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Not selected'}</strong></div><div className="booking-sidebar-row"><span>Guests</span><strong>{form.adults} adults{Number(form.children) ? ` · ${form.children} children` : ''}</strong></div><div className="booking-sidebar-row"><span>Rooms</span><strong>{roomCount}</strong></div><div className="booking-sidebar-row"><span>Payment</span><strong>{selectedPayment.label}</strong></div>{selectedRoom && <div className="booking-sidebar-room"><span>Selected room</span><strong>{selectedRoom.name}</strong></div>}{quote && <div className="booking-sidebar-total"><span>Quoted total</span><strong>{money(quoteTotal, quoteCurrency)}</strong></div>}</div><div className="booking-sidebar-note"><span className="booking-sidebar-icon">✓</span><p><strong>Corporate rate protection</strong>Your approved contract rate is applied before the reservation is created and remains linked to your company account.</p></div><div className="booking-sidebar-note"><span className="booking-sidebar-icon">i</span><p><strong>Need help?</strong>Our reservations team can assist with room choices, payment terms, or guest details.</p></div></aside></div>
  </div>;
}

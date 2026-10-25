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
  rate: { currency: string; subtotal?: number; nightlyRate?: number; baseNightlyRate?: number; corporateFactors?: { stayLength?: any[]; roomCount?: any[]; paymentMode?: Record<string, any> } } | null;
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

function matchingAdjustment(factors: any[] | undefined, nights: number, rooms: number) {
  return (factors || []).find((factor) => (factor.minNights == null || nights >= Number(factor.minNights)) && (factor.maxNights == null || nights <= Number(factor.maxNights)) && (factor.minRooms == null || rooms >= Number(factor.minRooms)) && (factor.maxRooms == null || rooms <= Number(factor.maxRooms))) || null;
}

function adjustmentLabel(adjustment: any, currency = 'NGN') {
  if (!adjustment) return '';
  const value = Number(adjustment.value || 0);
  const type = String(adjustment.adjustmentType || '').toUpperCase();
  if (type === 'PERCENT_DISCOUNT' || type === 'PERCENTAGE_DISCOUNT') return value > 0 ? `${value}% discount` : '';
  if (type === 'FIXED_NIGHTLY_ADJUSTMENT' || type === 'FIXED_DISCOUNT') return value < 0 ? `${money(Math.abs(value), currency)} discount / night` : value > 0 ? `${money(value, currency)} adjustment / night` : '';
  return type === 'MULTIPLIER' ? `Contract multiplier × ${value}` : '';
}

function paymentAdjustmentFor(factors: any, paymentMode: string) {
  const paymentFactors = factors?.paymentMode || {};
  const entry = Object.entries(paymentFactors).find(([key]) => key.toUpperCase() === paymentMode.toUpperCase());
  return entry?.[1] || null;
}

function displayedNightlyRate(baseRate: number | null | undefined, factors: any, nights: number, rooms: number, paymentMode: string) {
  if (baseRate == null || !Number.isFinite(Number(baseRate))) return null;
  const adjustments = [matchingAdjustment(factors?.stayLength, nights, rooms), matchingAdjustment(factors?.roomCount, nights, rooms), paymentAdjustmentFor(factors, paymentMode)].filter(Boolean);
  return adjustments.reduce((amount: number, adjustment: any) => {
    const value = Number(adjustment.value || 0);
    if (adjustment.adjustmentType === 'PERCENT_DISCOUNT') return amount * (1 - value / 100);
    if (adjustment.adjustmentType === 'MULTIPLIER') return amount * value;
    return amount + value;
  }, Number(baseRate));
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
  const paymentOptionsWithDiscounts = paymentOptions.map((option) => {
    const adjustment = rooms.map((room) => paymentAdjustmentFor(room.rate?.corporateFactors, option.value)).find(Boolean);
    const discount = adjustmentLabel(adjustment, selectedRoom?.rate?.currency || 'NGN');
    return { ...option, discount: discount || (rooms.length ? 'No additional payment discount' : 'Discount shown after availability') };
  });

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
    <section className="booking-intro"><div><span className="booking-kicker">Stanzel Grand Resort · Corporate services</span><h2>Plan your team stay with confidence.</h2><p>Live availability, transparent corporate pricing and a PMS-connected reservation journey for your organisation.</p></div><div className="booking-assurance"><span>✓ Live room inventory</span><span>✓ Corporate terms</span><span>✓ Secure reservation</span></div></section>
    <nav className="booking-progress" aria-label="Reservation progress"><span className={stage >= 1 ? 'is-active' : ''}><b>1</b> Search dates</span><i /><span className={stage >= 2 ? 'is-active' : ''}><b>2</b> Choose rooms</span><i /><span className={stage >= 3 ? 'is-active' : ''}><b>3</b> Review & reserve</span></nav>
    <div className="booking-layout"><div className="booking-main">

    {stage === 1 && <section className="booking-card booking-search-card"><div className="booking-card-heading"><div><span className="booking-section-kicker">Step 1 · Search availability</span><h3>Find rooms for your team</h3><p>Select one stay period for the whole room arrangement, then choose the room types your team needs.</p></div><span className="booking-step-count">01 / 03</span></div><form className="booking-form" onSubmit={search}><label className="booking-field booking-field-date"><span>Check-in</span><input type="date" required value={form.checkIn} onChange={(event) => update('checkIn', event.target.value)} /><small>{form.checkIn ? dateLabel(form.checkIn) : 'Select arrival date'}</small></label><label className="booking-field booking-field-date"><span>Check-out</span><input type="date" required value={form.checkOut} min={form.checkIn || undefined} onChange={(event) => update('checkOut', event.target.value)} /><small>{nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Select departure date'}</small></label><label className="booking-field"><span>Adults per room</span><input type="number" min="1" max="20" required value={form.adults} onChange={(event) => update('adults', event.target.value)} /><small>Guests aged 13+</small></label><label className="booking-field"><span>Children per room</span><input type="number" min="0" max="20" required value={form.children} onChange={(event) => update('children', event.target.value)} /><small>Guests aged 0–12</small></label><div className="booking-payment-field"><span>Payment arrangement</span><div className="booking-payment-options">{paymentOptions.map((option) => <button type="button" key={option.value} className={form.paymentMode === option.value ? 'is-selected' : ''} onClick={() => update('paymentMode', option.value)}><span className="booking-radio" /><span><strong>{option.label}</strong><small>{option.description}</small></span></button>)}</div></div>{nights > 0 && <div className="booking-promo"><span>✦</span><div><strong>{nights} night{nights === 1 ? '' : 's'} planned — unlock your default corporate savings</strong>{nights >= 7 ? 'Extended stays are being evaluated for the best available long-stay rate.' : 'Longer stays can qualify for additional contract savings. We will show the exact eligible discount with your available rooms.'}</div></div>}<div className="booking-form-footer"><span className="booking-form-note"><b>i</b> Your corporate rate is applied before the quote is created.</span><button className="booking-primary-button" disabled={busy}>{busy ? 'Checking availability…' : <>Check availability <span>→</span></>}</button></div></form></section>}

    {stage === 2 && rooms.length > 0 && <section className="booking-card booking-room-card"><div className="booking-card-heading"><div><span className="booking-section-kicker">Step 2 · Choose rooms</span><h3>Build your room arrangement</h3><p>Compare room types and select the quantity required for your stay. Rates shown are per room, per night.</p></div><span className="booking-step-count">02 / 03</span></div><div className="booking-stay-summary"><span>Stay <strong>{dateLabel(form.checkIn)} — {dateLabel(form.checkOut)}</strong></span><span><strong>{nights}</strong> night{nights === 1 ? '' : 's'}</span><label className="booking-payment-select"><span>Payment arrangement</span><select value={form.paymentMode} onChange={(event) => update('paymentMode', event.target.value)}>{paymentOptionsWithDiscounts.map((option) => <option value={option.value} key={option.value}>{option.label} · {option.discount}</option>)}</select></label><span><strong>{roomCount}</strong> room{roomCount === 1 ? '' : 's'} selected</span></div><div className="booking-room-list">{rooms.map((room) => { const available = room.rate && room.availability.isAvailable; const selected = room.id === roomTypeId; const image = room.photos?.[0] || '/images/room-suite.jpg'; const factors = room.rate?.corporateFactors; const stayAdjustment = matchingAdjustment(factors?.stayLength, nights, roomCount); const roomAdjustment = matchingAdjustment(factors?.roomCount, nights, roomCount); const paymentAdjustment = paymentAdjustmentFor(factors, form.paymentMode); const discountLabels = [adjustmentLabel(stayAdjustment, room.rate?.currency) && `${nights}-night stay: ${adjustmentLabel(stayAdjustment, room.rate?.currency)}`, adjustmentLabel(roomAdjustment, room.rate?.currency) && `${roomCount} room${roomCount === 1 ? '' : 's'}: ${adjustmentLabel(roomAdjustment, room.rate?.currency)}`, adjustmentLabel(paymentAdjustment, room.rate?.currency) && `${selectedPayment.label}: ${adjustmentLabel(paymentAdjustment, room.rate?.currency)}`].filter(Boolean) as string[]; const nightlyRate = displayedNightlyRate(room.rate?.baseNightlyRate, factors, nights, roomCount, form.paymentMode) ?? room.rate?.nightlyRate; return <article className={`booking-room-option${selected ? ' is-selected' : ''}${!available ? ' is-unavailable' : ''}`} key={room.id}><button type="button" className="booking-room-select" disabled={!available} onClick={() => { setRoomTypeId(room.id); setQuote(null); }}><span className="booking-room-image"><img src={image} alt="" /><span>{available ? `${room.availability.available} available` : 'Unavailable'}</span></span></button><div className="booking-room-details"><div className="booking-room-top"><span><strong>{room.name}</strong><small>{room.description || 'Comfortable accommodation for business travel.'}</small></span><span className="booking-room-price"><strong>{nightlyRate != null ? money(nightlyRate, room.rate?.currency) : 'Corporate rate'}</strong><small>{nightlyRate != null ? 'per room / night' : 'calculated next'}</small></span></div><div className="booking-discount-note"><strong>Default corporate price</strong>{discountLabels.length ? discountLabels.map((discount) => <span key={discount}>✓ {discount}</span>) : <span>✓ Contract pricing is applied to this room type.</span>}</div><div className="booking-room-tags">{(room.amenities || ['Wi-Fi', 'Breakfast available']).slice(0, 3).map((amenity) => <em key={amenity}>{amenity}</em>)}</div><div className="booking-room-bottom"><span className="booking-room-status">{selected ? 'Selected for your quote' : available ? 'Select this room type' : 'Not available for these dates'}</span><label className="booking-room-quantity"><span>Rooms</span><input type="number" min="1" max="20" value={selected ? form.roomCount : 0} disabled={!available || !selected} onChange={(event) => update('roomCount', event.target.value)} /></label><span className="booking-select-mark">{selected ? '✓' : '○'}</span></div></div></article>; })}</div><div className="booking-room-footer"><button type="button" className="booking-back-button" onClick={() => setStage(1)}>← Edit stay details</button><span>{selectedRoom ? <><strong>{selectedRoom.name}</strong> selected · {roomCount} room{roomCount === 1 ? '' : 's'}</> : 'Choose an available room type to continue.'}</span><button type="button" className="booking-secondary-button" disabled={!roomTypeId || busy} onClick={requestQuote}>{busy ? 'Preparing quote…' : 'Review corporate quote →'}</button></div></section>}

    {stage === 3 && quote && <section className="booking-card booking-review-card"><div className="booking-card-heading"><div><span className="booking-section-kicker">Step 3 · Review & reserve</span><h3>Your corporate reservation summary</h3><p>Review the rate, stay details, and guest information before creating the reservation.</p></div><span className="booking-step-count">03 / 03</span></div><div className="booking-review-layout"><div className="booking-summary-panel"><div className="booking-summary-title"><span>Reservation summary</span><em>Quote expires {quote.expiresAt ? new Date(quote.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'soon'}</em></div><div className="booking-summary-room"><span className="booking-summary-room-icon">⌂</span><span><strong>{selectedRoom?.name || 'Selected room'}</strong><small>{dateLabel(form.checkIn)} — {dateLabel(form.checkOut)} · {nights} night{nights === 1 ? '' : 's'}</small></span></div><div className="booking-summary-lines"><div><span>Guests</span><strong>{form.adults} adult{Number(form.adults) === 1 ? '' : 's'}{Number(form.children) ? `, ${form.children} child${Number(form.children) === 1 ? '' : 'ren'}` : ''}</strong></div><div><span>Rooms</span><strong>{roomCount}</strong></div><div><span>Payment</span><strong>{selectedPayment.label}</strong></div><div className="booking-summary-total"><span>Estimated total</span><strong>{money(quoteTotal, quoteCurrency)}</strong></div></div><p className="booking-summary-note">The final reservation will use the quoted corporate rate and remain linked to your company account.</p></div><div className="booking-guests-panel"><div className="booking-summary-title"><span>Guest details</span><em>{guests.length} room{guests.length === 1 ? '' : 's'}</em></div><p className="booking-guest-intro">Add one primary guest for each room. These details can also be completed later from Reservations.</p><div className="booking-guest-list">{guests.map((guest, index) => <fieldset className="booking-guest-card" key={index}><legend>Room {index + 1}</legend><div className="booking-guest-fields"><input required placeholder="First name" value={guest.firstName} onChange={(event) => updateGuest(index, 'firstName', event.target.value)} /><input required placeholder="Last name" value={guest.lastName} onChange={(event) => updateGuest(index, 'lastName', event.target.value)} /><input required type="email" placeholder="Email address" value={guest.email} onChange={(event) => updateGuest(index, 'email', event.target.value)} /><input placeholder="Phone (optional)" value={guest.phone} onChange={(event) => updateGuest(index, 'phone', event.target.value)} /></div></fieldset>)}</div></div></div><div className="booking-review-footer"><button type="button" className="booking-back-button" onClick={() => setStage(2)}>← Change room</button><span><b>✓</b> Secure PMS-connected reservation</span><button type="button" className="booking-primary-button" disabled={busy || guests.some((guest) => !guest.firstName || !guest.lastName || !guest.email)} onClick={book}>{busy ? 'Creating reservation…' : 'Confirm corporate reservation →'}</button></div></section>}
    {error && <div className="booking-error"><strong>We could not complete that step</strong><span>{error}</span></div>}
    </div><aside className="booking-sidebar"><div className="booking-sidebar-heading"><span>YOUR STAY</span><strong>Reservation details</strong></div><div className="booking-sidebar-card"><div className="booking-sidebar-row"><span>Check-in</span><strong>{dateLabel(form.checkIn)}</strong></div><div className="booking-sidebar-row"><span>Check-out</span><strong>{dateLabel(form.checkOut)}</strong></div><div className="booking-sidebar-row"><span>Length</span><strong>{nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Not selected'}</strong></div><div className="booking-sidebar-row"><span>Guests</span><strong>{form.adults} adults{Number(form.children) ? ` · ${form.children} children` : ''}</strong></div><div className="booking-sidebar-row"><span>Rooms</span><strong>{roomCount}</strong></div><div className="booking-sidebar-row"><span>Payment</span><strong>{selectedPayment.label}</strong></div>{selectedRoom && <div className="booking-sidebar-room"><span>Selected room</span><strong>{selectedRoom.name}</strong></div>}{quote && <div className="booking-sidebar-total"><span>Quoted total</span><strong>{money(quoteTotal, quoteCurrency)}</strong></div>}</div><div className="booking-sidebar-note"><span className="booking-sidebar-icon">✓</span><p><strong>Corporate rate protection</strong>Your approved contract rate is applied before the reservation is created and remains linked to your company account.</p></div><div className="booking-sidebar-note"><span className="booking-sidebar-icon">i</span><p><strong>Need help?</strong>Our reservations team can assist with room choices, payment terms, or guest details.</p></div></aside></div>
  </div>;
}

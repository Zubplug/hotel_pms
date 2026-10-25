'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Room = {
  id: string;
  name: string;
  description?: string | null;
  photos?: string[];
  amenities?: string[];
  availability: { available: number; isAvailable: boolean };
  rate: { currency: string; subtotal?: number; corporateFactors?: { stayLength?: any[]; roomCount?: any[]; paymentMode?: Record<string, any> }; appliedAdjustments?: { stayLength?: any; roomCount?: any; paymentMode?: any } } | null;
};

type QuoteLine = any;

const fallbackImages = ['/images/room-suite.jpg', '/images/bathroom.jpg', '/images/lobby.jpg'];
const paymentOptions = [
  { value: 'PAY_LATER', label: 'Pay later', hint: 'Settle under your corporate terms' },
  { value: 'FULL', label: 'Pay in full', hint: 'Complete payment before arrival' },
  { value: 'DEPOSIT', label: 'Pay a deposit', hint: 'Pay the configured deposit amount' },
  { value: 'PREPAID', label: 'Prepaid', hint: 'Pay in advance before arrival' },
];
const countries = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'United States', 'Other country'];

type SelectOption = { value: string; label: string; hint?: string };

function ProfessionalSelect({ name, label, value, options, onChange }: { name: string; label: string; value: string; options: SelectOption[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];
  useEffect(() => {
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return <div className="corp-select-wrap" ref={rootRef}>
    <label className="corp-field-label">{label}</label>
    <input type="hidden" name={name} value={value} required />
    <button type="button" className={'corp-select-trigger ' + (open ? 'open' : '')} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span><strong>{selected.label}</strong>{selected.hint && <small>{selected.hint}</small>}</span><span className="corp-select-chevron">⌄</span>
    </button>
    {open && <div className="corp-select-menu" role="listbox" aria-label={label}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={'corp-select-option ' + (option.value === value ? 'selected' : '')} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span><strong>{option.label}</strong>{option.hint && <small>{option.hint}</small>}</span>{option.value === value && <span aria-hidden="true">✓</span>}</button>)}</div>}
  </div>;
}

const styles = [
  '.corp-page{--ink:#17241f;--muted:#68756f;--line:#dfe6e1;--soft:#f4f7f4;--forest:#173d32;--forest-2:#245c4a;--gold:#b88b48;--gold-soft:#f6eee2;max-width:1180px;margin:0 auto;padding:10px 0 72px;color:var(--ink)}',
  '.corp-hero{position:relative;overflow:hidden;border-radius:28px;background:linear-gradient(120deg,#173d32 0%,#225847 62%,#31705c 100%);color:#fff;padding:34px clamp(22px,5vw,62px);box-shadow:0 20px 50px rgba(23,61,50,.16)}',
  '.corp-hero:after{content:"";position:absolute;right:-120px;top:-160px;width:420px;height:420px;border:1px solid rgba(255,255,255,.14);border-radius:50%;box-shadow:0 0 0 45px rgba(255,255,255,.035),0 0 0 90px rgba(255,255,255,.025)}',
  '.corp-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.15em;font-weight:800;color:#e7c994;margin:0 0 12px}',
  '.corp-hero h1{font-size:clamp(28px,4vw,48px);line-height:1.05;letter-spacing:-.045em;max-width:650px;margin:0;color:#fff}',
  '.corp-hero p{max-width:650px;color:rgba(255,255,255,.74);line-height:1.7;margin:16px 0 0;font-size:14px}',
  '.corp-trust{display:flex;flex-wrap:wrap;gap:9px;margin-top:24px}.corp-trust span{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);border-radius:999px;padding:8px 12px;font-size:11px;color:rgba(255,255,255,.84)}',
  '.corp-stepbar{display:flex;align-items:center;gap:0;margin:28px 0 22px;padding:0 4px}.corp-step{display:flex;align-items:center;gap:9px;color:#87938d;font-size:12px;font-weight:700;white-space:nowrap}.corp-step.active{color:var(--forest)}.corp-step-dot{display:grid;place-items:center;width:30px;height:30px;border:1px solid var(--line);border-radius:50%;background:#fff;font-size:12px}.corp-step.active .corp-step-dot{border-color:var(--forest);background:var(--forest);color:#fff}.corp-step-line{height:1px;background:var(--line);flex:1;margin:0 12px}.corp-step-line.active{background:var(--gold)}',
  '.corp-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}.corp-panel{background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:0 10px 30px rgba(23,61,50,.05)}.corp-main{padding:clamp(20px,4vw,34px)}.corp-side{padding:20px;position:sticky;top:18px}',
  '.corp-title-row{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.corp-title-row h2{font-size:24px;letter-spacing:-.035em;margin:0}.corp-title-row p{font-size:13px;line-height:1.6;color:var(--muted);margin:7px 0 0}.corp-kicker{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:800;margin:0 0 8px}',
  '.corp-form{display:grid;gap:17px;margin-top:26px}.corp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.corp-field{display:grid;gap:7px}.corp-field label,.corp-field legend{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#596761}.corp-input,.corp-select{width:100%;border:1px solid var(--line);background:#fbfcfb;border-radius:11px;padding:13px 14px;color:var(--ink);font:inherit;font-size:14px;outline:none;transition:border .18s,box-shadow .18s}.corp-input:focus,.corp-select:focus{border-color:var(--forest-2);box-shadow:0 0 0 3px rgba(36,92,74,.12);background:#fff}.corp-button{border:0;border-radius:11px;padding:13px 17px;background:var(--forest);color:#fff;font:inherit;font-weight:800;cursor:pointer;transition:transform .18s,background .18s;min-height:46px}.corp-button:hover{background:var(--forest-2);transform:translateY(-1px)}.corp-button:disabled{opacity:.5;cursor:not-allowed;transform:none}.corp-button.secondary{background:#fff;color:var(--forest);border:1px solid var(--line)}.corp-button.gold{background:var(--gold)}',
  '.corp-select-wrap{position:relative;display:grid;gap:7px}.corp-field-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#596761}.corp-select-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid var(--line);background:#fbfcfb;border-radius:11px;padding:11px 14px;color:var(--ink);font:inherit;cursor:pointer;min-height:52px}.corp-select-trigger:hover,.corp-select-trigger.open{border-color:var(--forest-2);background:#fff;box-shadow:0 0 0 3px rgba(36,92,74,.1)}.corp-select-trigger strong,.corp-select-option strong{display:block;font-size:13px}.corp-select-trigger small,.corp-select-option small{display:block;color:var(--muted);font-size:11px;margin-top:2px}.corp-select-chevron{font-size:19px;color:var(--forest-2);line-height:1}.corp-select-menu{position:absolute;z-index:30;top:calc(100% + 7px);left:0;right:0;display:grid;gap:3px;padding:6px;background:#fff;border:1px solid var(--line);border-radius:13px;box-shadow:0 18px 40px rgba(23,61,50,.16)}.corp-select-option{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;border:0;border-radius:9px;background:#fff;padding:11px 10px;text-align:left;color:var(--ink);font:inherit;cursor:pointer}.corp-select-option:hover,.corp-select-option.selected{background:var(--soft)}.corp-select-option.selected{color:var(--forest)}',
  '.corp-search-note{display:flex;gap:10px;align-items:flex-start;padding:14px 15px;background:var(--soft);border-radius:12px;color:var(--muted);font-size:12px;line-height:1.55}.corp-search-note strong{display:block;color:var(--ink);margin-bottom:2px}.corp-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:var(--gold-soft);color:#8c652d;font-weight:900;flex:none}',
  '.corp-promo{display:flex;gap:12px;align-items:flex-start;margin-top:14px;padding:14px 15px;border:1px solid #ead7b8;background:linear-gradient(135deg,#fffaf1,#f8f4ea);border-radius:13px;color:#70552d;font-size:12px;line-height:1.55}.corp-promo strong{display:block;color:#4e3a1e;margin-bottom:3px}.corp-promo .corp-icon{background:#f2dfbb;color:#876126}',
  '.corp-inline-alert{display:flex;align-items:flex-start;gap:10px;margin-top:16px;padding:12px 14px;border:1px solid #e5b7b2;background:#fff5f3;border-radius:12px;color:#8f3f38;font-size:12px;line-height:1.5}.corp-inline-alert strong{display:block;color:#73302b;margin-bottom:2px}',
  '.corp-discount-note{display:grid;gap:5px;margin-top:12px;padding:11px 12px;border:1px solid #d8e8de;background:#f4faf5;border-radius:11px;color:#35644b;font-size:11px;line-height:1.45}.corp-discount-note strong{color:#214e38}.corp-discount-note span{display:block}',
  '.corp-room-list{display:grid;gap:14px;margin-top:24px}.corp-room{display:grid;grid-template-columns:190px minmax(0,1fr);overflow:hidden;border:1px solid var(--line);border-radius:17px;background:#fff;transition:border .18s,box-shadow .18s}.corp-room.selected{border-color:var(--forest-2);box-shadow:0 0 0 3px rgba(36,92,74,.1)}.corp-room.unavailable{opacity:.58}.corp-room-image{position:relative;min-height:190px;background:#dfe8e1}.corp-room-image img{width:100%;height:100%;display:block;object-fit:cover}.corp-room-badge{position:absolute;left:12px;top:12px;background:rgba(23,61,50,.9);color:#fff;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800}.corp-room-body{padding:19px}.corp-room-top{display:flex;justify-content:space-between;gap:14px}.corp-room h3{font-size:17px;margin:0;letter-spacing:-.02em}.corp-room-sub{font-size:12px;color:var(--muted);line-height:1.5;margin:6px 0 0}.corp-room-price{text-align:right;white-space:nowrap}.corp-room-price strong{display:block;font-size:15px}.corp-room-price span{font-size:10px;color:var(--muted)}.corp-amenities{display:flex;flex-wrap:wrap;gap:6px;margin:17px 0}.corp-amenities span{border:1px solid var(--line);border-radius:999px;padding:5px 8px;color:var(--muted);font-size:10px}.corp-room-bottom{display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid var(--line);padding-top:14px}.corp-availability{font-size:11px;font-weight:800;color:#287252}.corp-availability.low{color:#9b6b22}.corp-availability.none{color:#a04a43}.corp-quantity{display:flex;align-items:center;gap:8px}.corp-quantity label{font-size:11px;color:var(--muted)}.corp-quantity input{width:68px;text-align:center;padding:9px 7px}.corp-extra{margin-top:10px;padding:14px;border:1px dashed #d7c29f;background:#fffaf2;border-radius:13px}.corp-extra-title{font-size:12px;font-weight:800;color:#6e5127;margin-bottom:10px}',
  '.corp-summary-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.corp-summary-head h3{font-size:15px;margin:0}.corp-secure{font-size:10px;color:#287252;font-weight:800}.corp-summary-card{margin-top:15px;padding:14px;border-radius:14px;background:var(--soft);display:grid;gap:11px}.corp-summary-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:var(--muted)}.corp-summary-row strong{color:var(--ink);text-align:right}.corp-summary-total{border-top:1px solid var(--line);padding-top:12px;font-size:15px;color:var(--ink)}.corp-side-note{margin-top:18px;padding-top:17px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.6}.corp-side-note strong{display:block;color:var(--ink);font-size:12px;margin-bottom:5px}',
  '.corp-review{display:grid;gap:18px}.corp-review-table{overflow:auto;border:1px solid var(--line);border-radius:14px}.corp-review table{width:100%;border-collapse:collapse;min-width:650px;font-size:12px}.corp-review th,.corp-review td{text-align:left;padding:12px;border-bottom:1px solid var(--line)}.corp-review th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:var(--soft)}.corp-review tr:last-child td{border-bottom:0}.corp-review-total{margin-left:auto;max-width:360px;display:grid;gap:9px}.corp-review-total .corp-summary-row.total{border-top:1px solid var(--line);padding-top:12px;font-size:18px;color:var(--ink)}.corp-alert{margin-top:18px;padding:13px 15px;border-radius:11px;background:#fff2f0;border:1px solid #f0c9c2;color:#98443c;font-size:12px}.corp-empty{padding:38px 20px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:15px;font-size:13px}.corp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.corp-actions .corp-button{flex:1}.corp-footer-note{margin-top:25px;text-align:center;font-size:11px;color:var(--muted)}',
  '@media(max-width:850px){.corp-layout{grid-template-columns:1fr}.corp-side{position:static;order:-1}.corp-room{grid-template-columns:145px minmax(0,1fr)}.corp-room-image{min-height:175px}}',
  '@media(max-width:560px){.corp-page{padding-top:0}.corp-hero{border-radius:20px;padding:26px 20px}.corp-step{font-size:0}.corp-step-dot{font-size:11px}.corp-step-line{margin:0 7px}.corp-grid{grid-template-columns:1fr}.corp-main{padding:19px 16px}.corp-room{grid-template-columns:1fr}.corp-room-image{height:175px;min-height:0}.corp-room-body{padding:15px}.corp-room-top{display:block}.corp-room-price{text-align:left;margin-top:10px}.corp-room-bottom{align-items:flex-start;flex-direction:column}.corp-quantity{width:100%;justify-content:space-between}.corp-quantity input{width:86px}.corp-actions{flex-direction:column}.corp-actions .corp-button{width:100%}}',
].join('\n');

function money(value: unknown, currency = 'NGN') {
  return currency + ' ' + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Date(value + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function matchingAdjustment(factors: any[] | undefined, nights: number, rooms: number) {
  return (factors || []).find((factor) => (factor.minNights == null || nights >= Number(factor.minNights)) && (factor.maxNights == null || nights <= Number(factor.maxNights)) && (factor.minRooms == null || rooms >= Number(factor.minRooms)) && (factor.maxRooms == null || rooms <= Number(factor.maxRooms))) || null;
}

function adjustmentLabel(adjustment: any) {
  if (!adjustment) return '';
  const value = Number(adjustment.value || 0);
  if (adjustment.adjustmentType === 'PERCENT_DISCOUNT') return value > 0 ? `${value}% discount` : '';
  if (adjustment.adjustmentType === 'FIXED_NIGHTLY_ADJUSTMENT') return value < 0 ? `${money(Math.abs(value))} discount / night` : '';
  return '';
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86_400_000);
}

export default function CorporateApplyPage() {
  const router = useRouter();
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ checkIn: '', checkOut: '', adults: '2', children: '0', paymentMode: 'PAY_LATER' });
  const [country, setCountry] = useState('Nigeria');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomSelections, setRoomSelections] = useState<Record<string, number>>({});
  const [roomDates, setRoomDates] = useState<Record<string, { checkIn: string; checkOut: string }>>({});
  const [additionalLines, setAdditionalLines] = useState<Array<{ roomTypeId: string; roomCount: number; checkIn: string; checkOut: string }>>([]);
  const [quote, setQuote] = useState<any>(null);
  const [bookingMode, setBookingMode] = useState<'STANDARD' | 'NEGOTIATE'>('STANDARD');
  const [negotiatedAmounts, setNegotiatedAmounts] = useState<Record<string, string>>({});
  const [negotiation, setNegotiation] = useState<any>(null);
  const [error, setError] = useState('');
  const [roomSelectionError, setRoomSelectionError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedRoomCount = Object.values(roomSelections).reduce((sum, count) => sum + count, 0) + additionalLines.reduce((sum, line) => sum + line.roomCount, 0);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setQuote(null);
    try {
      const response = await fetch('/api/corporate/availability?' + new URLSearchParams(form));
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Availability unavailable.');
      const available = body.rooms || [];
      setRooms(available); setRoomSelections({}); setAdditionalLines([]); setRoomSelectionError('');
      setRoomDates(Object.fromEntries(available.map((room: Room) => [room.id, { checkIn: form.checkIn, checkOut: form.checkOut }])));
      setStage(2);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not search availability.'); }
    finally { setBusy(false); }
  }

  function validateRoomSelection() {
    for (const room of rooms) {
      const count = Number(roomSelections[room.id] || 0);
      if (!Number.isInteger(count) || count < 0) return `Enter a valid whole number of rooms for ${room.name}.`;
      if (count > room.availability.available) return `${room.name} has only ${room.availability.available} room${room.availability.available === 1 ? '' : 's'} available for these dates.`;
      if (count > 0) {
        const dates = roomDates[room.id] || { checkIn: form.checkIn, checkOut: form.checkOut };
        if (!dates.checkIn || !dates.checkOut || dates.checkOut <= dates.checkIn) return `Choose a departure date after arrival for ${room.name}.`;
      }
    }
    if (selectedRoomCount < 1) return 'Select at least one available room to continue.';
    return '';
  }

  function continueToDetails() {
    const validationError = validateRoomSelection();
    setRoomSelectionError(validationError);
    if (!validationError) setStage(3);
  }

  async function createApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoomCount) return;
    setBusy(true); setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const selections = [
      ...Object.entries(roomSelections).filter(([, count]) => count > 0).map(([roomTypeId, roomCount]) => ({ roomTypeId, roomCount, ...roomDates[roomTypeId] })),
      ...additionalLines.filter((line) => line.roomCount > 0),
    ];
    try {
      const application = await fetch('/api/corporate/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const applicationBody = await application.json();
      if (!application.ok) throw new Error(applicationBody.error || 'Unable to create corporate application.');
      const quoteResponse = await fetch('/api/corporate/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ roomSelections: selections, roomTypeId: selections[0].roomTypeId, checkIn: form.checkIn, checkOut: form.checkOut, adults: Number(form.adults), children: Number(form.children), roomCount: selectedRoomCount, paymentMode: form.paymentMode }) });
      const quoteBody = await quoteResponse.json();
      if (!quoteResponse.ok) throw new Error(quoteBody.error || 'Corporate rate unavailable.');
      const lines = quoteBody.snapshot?.roomSelections?.length ? quoteBody.snapshot.roomSelections : [quoteBody.snapshot];
      setNegotiatedAmounts(Object.fromEntries(lines.map((line: QuoteLine, index: number) => [line.request.roomTypeId + ':' + index, String(line.pricing?.nightlyRates?.[0]?.amount || line.roomChargeBreakdown?.grossRate || 0)])));
      setQuote(quoteBody); setStage(3);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare your reservation.'); }
    finally { setBusy(false); }
  }

  async function completeBooking(quoteId: string) {
    const response = await fetch('/api/corporate/booking', { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ quoteId, deferGuestDetails: true, specialRequests: 'Guest details to be completed in the corporate portal or at Front Desk' }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not create reservation.');
    if (body.paymentRequired && body.reservationId) {
      const payment = await fetch('/api/corporate/payment?reservationId=' + encodeURIComponent(body.reservationId), { method: 'POST', headers: { 'content-type': 'application/json', 'x-idempotency-key': 'payment-' + crypto.randomUUID() }, body: JSON.stringify({ email: body.contactEmail }) });
      const paymentBody = await payment.json();
      if (!payment.ok) throw new Error(paymentBody.error || 'Could not initialize payment.');
      if (paymentBody.authorizationUrl) { window.location.href = paymentBody.authorizationUrl; return; }
    }
    router.push('/corporate/reservations');
  }

  async function requestNegotiation() {
    if (!quote?.quoteId) return;
    setBusy(true); setError('');
    const snapshot = quote.snapshot; const lines = snapshot?.roomSelections?.length ? snapshot.roomSelections : [snapshot];
    try {
      const response = await fetch('/api/corporate/rate-negotiation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quoteId: quote.quoteId, reference: 'Website booking ' + new Date().toISOString().slice(0, 10), requestedTerms: { checkIn: form.checkIn, checkOut: form.checkOut, adults: Number(form.adults), children: Number(form.children), paymentMode: form.paymentMode, roomSelections: lines.map((line: QuoteLine) => line.request) }, proposedRates: lines.map((line: QuoteLine, index: number) => ({ roomTypeId: line.request.roomTypeId, amount: Number(negotiatedAmounts[line.request.roomTypeId + ':' + index] || line.pricing?.nightlyRates?.[0]?.amount || line.roomChargeBreakdown?.grossRate || 0), currency: line.totals.currency, minStay: line.pricing.nights, minRooms: line.request.roomCount })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit negotiation request.');
      setNegotiation(body);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const statusResponse = await fetch('/api/corporate/rate-negotiation?id=' + encodeURIComponent(body.id));
        const status = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(status.error || 'Unable to check negotiation status.');
        if (status.status === 'REJECTED') throw new Error(status.reviewerNotes || 'The negotiated rate request was rejected.');
        if (status.status === 'APPROVED') {
          const approvedQuoteResponse = await fetch('/api/corporate/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...snapshot.request, roomSelections: snapshot.request.roomSelections, roomTypeId: snapshot.request.roomTypeId }) });
          const approvedQuote = await approvedQuoteResponse.json();
          if (!approvedQuoteResponse.ok) throw new Error(approvedQuote.error || 'The approved corporate quote is no longer available.');
          setQuote(approvedQuote); setBookingMode('STANDARD'); await completeBooking(approvedQuote.quoteId); return;
        }
      }
      throw new Error('The negotiation is still under review. You can return to the corporate portal later to continue.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit negotiation request.'); }
    finally { setBusy(false); }
  }

  async function book() {
    if (!quote?.quoteId) return;
    if (bookingMode === 'NEGOTIATE') { await requestNegotiation(); return; }
    setBusy(true); setError('');
    try { await completeBooking(quote.quoteId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not complete reservation.'); }
    finally { setBusy(false); }
  }

  const stepLabels = ['Search dates', 'Choose rooms', 'Review & reserve'];
  const selectedPayment = paymentOptions.find((item) => item.value === form.paymentMode) || paymentOptions[0];
  const searchNights = nightsBetween(form.checkIn, form.checkOut);
  const paymentOptionsWithDiscounts = paymentOptions.map((option) => {
    const adjustment = rooms.map((room) => room.rate?.corporateFactors?.paymentMode?.[option.value]).find(Boolean);
    const discount = adjustmentLabel(adjustment);
    return { ...option, hint: discount ? `${option.hint} · ${discount}` : option.hint };
  });
  const selectedPaymentWithDiscount = paymentOptionsWithDiscounts.find((item) => item.value === form.paymentMode) || paymentOptionsWithDiscounts[0];

  return <main className="corp-page">
    <style>{styles}</style>
    <section className="corp-hero">
      <p className="corp-eyebrow">Stanzel Grand Resort · Corporate services</p>
      <h1>Plan your team stay with confidence.</h1>
      <p>Live availability, transparent corporate pricing and a PMS-connected reservation journey for your organisation.</p>
      <div className="corp-trust"><span>✓ Live room inventory</span><span>✓ Corporate terms</span><span>✓ Secure reservation</span></div>
    </section>

    <nav className="corp-stepbar" aria-label="Reservation progress">
      {stepLabels.map((label, index) => <div key={label} style={{ display: 'contents' }}>
        <div className={'corp-step ' + (index + 1 <= stage ? 'active' : '')}><span className="corp-step-dot">{index + 1}</span><span>{label}</span></div>
        {index < stepLabels.length - 1 && <span className={'corp-step-line ' + (index + 1 < stage ? 'active' : '')} />}
      </div>)}
    </nav>

    <div className="corp-layout">
      <section className="corp-panel corp-main">
        {stage === 1 && <div>
          <div className="corp-title-row"><div><p className="corp-kicker">Step 1 · Search availability</p><h2>Find rooms for your team</h2><p>Start with the dates and occupancy. You can select different room types and arrival dates next.</p></div><span className="corp-icon">01</span></div>
          <form className="corp-form" onSubmit={search}>
            <div className="corp-grid">
              <div className="corp-field"><label htmlFor="check-in">Check-in</label><input id="check-in" className="corp-input" type="date" required value={form.checkIn} onChange={(e) => update('checkIn', e.target.value)} /></div>
              <div className="corp-field"><label htmlFor="check-out">Check-out</label><input id="check-out" className="corp-input" type="date" required value={form.checkOut} onChange={(e) => update('checkOut', e.target.value)} /></div>
            </div>
            <div className="corp-grid">
              <div className="corp-field"><label htmlFor="adults">Adults per room</label><input id="adults" className="corp-input" type="number" min="1" required value={form.adults} onChange={(e) => update('adults', e.target.value)} /></div>
              <div className="corp-field"><label htmlFor="children">Children per room</label><input id="children" className="corp-input" type="number" min="0" value={form.children} onChange={(e) => update('children', e.target.value)} /></div>
            </div>
              <ProfessionalSelect name="paymentMode" label="Payment arrangement" value={form.paymentMode} options={paymentOptionsWithDiscounts} onChange={(value) => update('paymentMode', value)} />
            {searchNights > 0 && <div className="corp-promo"><span className="corp-icon">✦</span><div><strong>{searchNights} night{searchNights === 1 ? '' : 's'} planned — unlock your default corporate savings</strong>{searchNights >= 7 ? 'Extended stays are being evaluated for the best available long-stay rate.' : 'Longer stays can qualify for additional contract savings. We will show the exact eligible discount with your available rooms.'}</div></div>}
            <div className="corp-search-note"><span className="corp-icon">i</span><div><strong>Rates are tailored to your organisation</strong>Room availability is visible immediately. Your corporate rate is calculated after company details are securely submitted.</div></div>
            <button className="corp-button" disabled={busy}>{busy ? 'Checking live availability…' : 'Check availability'}</button>
          </form>
        </div>}

        {stage === 2 && <div>
          <div className="corp-title-row"><div><p className="corp-kicker">Step 2 · Choose rooms</p><h2>Build your room arrangement</h2><p>Compare room types, select quantities and add different stay dates when your team arrives in waves.</p></div><span className="corp-icon">02</span></div>
          <div style={{ marginTop: 22, maxWidth: 520 }}><ProfessionalSelect name="paymentMode" label="Payment arrangement · default corporate pricing" value={form.paymentMode} options={paymentOptionsWithDiscounts} onChange={(value) => update('paymentMode', value)} /></div>
          {rooms.length === 0 ? <div className="corp-empty">No rooms are available for these dates. Try a different date range.</div> : <div className="corp-room-list">{rooms.map((room, index) => {
            const count = roomSelections[room.id] || 0;
            const dates = roomDates[room.id] || { checkIn: form.checkIn, checkOut: form.checkOut };
            const available = room.availability.isAvailable && room.availability.available > 0;
            const image = room.photos?.[0] || fallbackImages[index % fallbackImages.length];
            const amenityList = (room.amenities || []).slice(0, 3);
            const nights = Math.max(1, searchNights);
            const factors = room.rate?.corporateFactors;
            const stayDiscount = matchingAdjustment(factors?.stayLength, nights, count || 1);
            const roomDiscount = count > 0 ? matchingAdjustment(factors?.roomCount, nights, count) : null;
            const paymentDiscount = factors?.paymentMode?.[form.paymentMode];
            const discountLabels = [adjustmentLabel(stayDiscount) && `${nights}-night stay: ${adjustmentLabel(stayDiscount)}`, adjustmentLabel(roomDiscount) && `${count} rooms: ${adjustmentLabel(roomDiscount)}`, adjustmentLabel(paymentDiscount) && `${selectedPaymentWithDiscount.label}: ${adjustmentLabel(paymentDiscount)}`].filter(Boolean) as string[];
            return <article className={'corp-room ' + (count ? 'selected ' : '') + (!available ? 'unavailable' : '')} key={room.id}>
              <div className="corp-room-image"><img src={image} alt={room.name} /><span className="corp-room-badge">{available ? 'Available' : 'Unavailable'}</span></div>
              <div className="corp-room-body">
                <div className="corp-room-top"><div><h3>{room.name}</h3><p className="corp-room-sub">{room.description || 'Comfortable accommodation prepared for business and group stays.'}</p></div><div className="corp-room-price"><strong>{room.rate?.subtotal != null ? money(room.rate.subtotal, room.rate.currency) : 'Corporate rate'}</strong><span>{room.rate?.subtotal != null ? 'from searched dates' : 'calculated next'}</span></div></div>
                <div className="corp-discount-note"><strong>Default corporate price</strong>{discountLabels.length > 0 ? discountLabels.map((discount) => <span key={discount}>✓ {discount}</span>) : <span>✓ Contract pricing is applied to this room type.</span>}</div>
                <div className="corp-amenities">{(amenityList.length ? amenityList : ['PMS-connected stay', 'Flexible terms', 'Front desk support']).map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
                <div className="corp-room-bottom"><span className={'corp-availability ' + (available ? (room.availability.available < 3 ? 'low' : '') : 'none')}>{available ? room.availability.available + ' room' + (room.availability.available === 1 ? '' : 's') + ' remaining' : 'Not available for these dates'}</span><div className="corp-quantity"><label htmlFor={'rooms-' + room.id}>Rooms</label><input id={'rooms-' + room.id} className="corp-input" type="number" min="0" max={room.availability.available} disabled={!available} value={count || ''} placeholder="0" onFocus={(event) => { if (count === 0) event.currentTarget.value = ''; }} onClick={(event) => { if (count === 0) event.currentTarget.value = ''; }} onChange={(event) => { const value = event.target.value === '' ? 0 : Number(event.target.value); setRoomSelections((current) => ({ ...current, [room.id]: Number.isFinite(value) ? Math.max(0, value) : 0 })); setRoomSelectionError(''); }} /></div></div>
                {count > 0 && <div className="corp-extra"><div className="corp-extra-title">Stay dates for this room type</div><div className="corp-grid"><div className="corp-field"><label>Arrival</label><input className="corp-input" type="date" required value={dates.checkIn} onChange={(event) => { setRoomDates((current) => ({ ...current, [room.id]: { ...dates, checkIn: event.target.value } })); setRoomSelectionError(''); }} /></div><div className="corp-field"><label>Departure</label><input className="corp-input" type="date" required min={dates.checkIn} value={dates.checkOut} onChange={(event) => { setRoomDates((current) => ({ ...current, [room.id]: { ...dates, checkOut: event.target.value } })); setRoomSelectionError(''); }} /></div></div></div>}
              </div>
            </article>;
          })}</div>}
          {roomSelectionError && <div className="corp-inline-alert" role="alert"><span aria-hidden="true">!</span><div><strong>Check your room selection</strong>{roomSelectionError}</div></div>}
          <div className="corp-actions"><button type="button" className="corp-button secondary" onClick={() => setStage(1)}>Change search</button><button type="button" className="corp-button" disabled={busy} onClick={continueToDetails}>Continue to organisation details</button></div>
        </div>}

        {stage === 3 && !quote && <div>
          <div className="corp-title-row"><div><p className="corp-kicker">Step 3 · Organisation details</p><h2>Tell us about your organisation</h2><p>Your selected rooms are ready. Submit these details so we can calculate the correct corporate rate and terms.</p></div><span className="corp-icon">03</span></div>
          <form className="corp-form" onSubmit={createApplication}>
            <div className="corp-grid"><div className="corp-field"><label>Company name</label><input className="corp-input" name="companyName" required minLength={2} autoComplete="organization" /></div><div className="corp-field"><label>Contact person</label><input className="corp-input" name="contactPerson" required minLength={2} autoComplete="name" /></div></div>
            <div className="corp-grid"><div className="corp-field"><label>Corporate email</label><input className="corp-input" name="contactEmail" type="email" required autoComplete="email" /></div><div className="corp-field"><label>Phone number</label><input className="corp-input" name="contactPhone" type="tel" required minLength={7} autoComplete="tel" /></div></div>
            <div className="corp-field"><label>Business address</label><input className="corp-input" name="companyAddress" required minLength={5} autoComplete="street-address" /></div>
            <div className="corp-grid"><div className="corp-field"><label>City</label><input className="corp-input" name="companyCity" required minLength={2} autoComplete="address-level2" /></div><ProfessionalSelect name="companyCountry" label="Country" value={country} options={countries.map((country) => ({ value: country, label: country }))} onChange={setCountry} /></div>
            <input type="hidden" name="currency" value="NGN" />
            <div className="corp-actions"><button type="button" className="corp-button secondary" onClick={() => setStage(2)}>Back to rooms</button><button className="corp-button" disabled={busy}>{busy ? 'Calculating corporate rate…' : 'Review corporate reservation'}</button></div>
          </form>
        </div>}

        {stage === 3 && quote && (() => {
          const snapshot = quote.snapshot; const lines = snapshot?.roomSelections?.length ? snapshot.roomSelections : [snapshot]; const mode = String(snapshot?.request?.paymentMode || '').toUpperCase(); const dueNow = mode === 'DEPOSIT' ? snapshot?.pricing?.depositAmount : ['FULL', 'PREPAID'].includes(mode) ? snapshot?.totals?.total : 0; const policy = lines.find((line: QuoteLine) => line.rateDecision?.negotiation)?.rateDecision?.negotiation; const totalRooms = lines.reduce((sum: number, line: QuoteLine) => sum + Number(line.request?.roomCount || 1), 0); const nights = Number(lines[0]?.pricing?.nights || 0); const canNegotiate = Boolean(policy?.enabled) && (!policy.minRooms || totalRooms >= policy.minRooms) && (!policy.minNights || nights >= policy.minNights);
          return <div className="corp-review"><div className="corp-title-row"><div><p className="corp-kicker">Review corporate reservation</p><h2>Your rate is ready</h2><p>Review the PMS-connected quote below before confirming the reservation.</p></div><span className="corp-icon">✓</span></div><div className="corp-review-table"><table><thead><tr>{['Room', 'Stay', 'Rooms', 'Nights', 'Cost / room / night', 'Line total'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{lines.map((line: QuoteLine, index: number) => { const currency = line.totals?.currency || snapshot.totals.currency; const roomCount = Number(line.request?.roomCount || 1); const lineNights = Number(line.pricing?.nights || 0); const lineTotal = Number(line.totals?.total || 0); const roomNightRate = line.pricing?.nightlyRates?.[0]?.amount ?? (roomCount > 0 && lineNights > 0 ? lineTotal / roomCount / lineNights : lineTotal); return <tr key={line.request.roomTypeId + '-' + index}><td><strong>{line.pricing?.roomTypeName || 'Room'}</strong><br /><span style={{ color: 'var(--muted)', fontSize: 11 }}>{line.rateDecision?.ratePlanName || 'Corporate rate'}</span></td><td>{formatDate(line.request?.checkIn)} – {formatDate(line.request?.checkOut)}</td><td>{roomCount}</td><td>{lineNights}</td><td><strong>{money(roomNightRate, currency)}</strong></td><td><strong>{money(lineTotal, currency)}</strong></td></tr>; })}</tbody></table></div><div className="corp-review-total"><div className="corp-summary-row"><span>Room subtotal</span><strong>{money(snapshot.totals?.subtotal, snapshot.totals?.currency)}</strong></div><div className="corp-summary-row"><span>VAT and service charge</span><strong>{money(Number(snapshot.roomChargeBreakdown?.vatAmount || 0) + Number(snapshot.roomChargeBreakdown?.serviceChargeAmount || 0), snapshot.totals?.currency)}</strong></div><div className="corp-summary-row total"><span>Total</span><strong>{money(snapshot.totals?.total, snapshot.totals?.currency)}</strong></div><div className="corp-summary-row"><span>{dueNow > 0 ? 'Due now' : 'Payment arrangement'}</span><strong>{dueNow > 0 ? money(dueNow, snapshot.totals?.currency) : selectedPayment.label}</strong></div></div>{canNegotiate && !negotiation && <div className="corp-search-note"><span className="corp-icon">↔</span><div><strong>Need a negotiated rate?</strong>Your stay meets the configured threshold. Request a review before payment is taken.<button type="button" className="corp-button secondary" style={{ marginTop: 10 }} disabled={busy} onClick={() => { setBookingMode('NEGOTIATE'); void requestNegotiation(); }}>Request negotiated rate</button></div></div>}{negotiation && <div className="corp-search-note"><span className="corp-icon">✓</span><div><strong>Negotiation submitted</strong>We are checking the request with the Stanzel reservations team.</div></div>}<div className="corp-actions"><button className="corp-button" disabled={busy} onClick={book}>{busy ? 'Creating reservation…' : 'Confirm corporate reservation'}</button></div></div>;
        })()}
        {error && <p className="corp-alert" role="alert">{error}</p>}
      </section>

      <aside className="corp-panel corp-side">
        <div className="corp-summary-head"><h3>Your stay</h3><span className="corp-secure">● SECURE</span></div>
        <div className="corp-summary-card"><div className="corp-summary-row"><span>Check-in</span><strong>{formatDate(form.checkIn)}</strong></div><div className="corp-summary-row"><span>Check-out</span><strong>{formatDate(form.checkOut)}</strong></div><div className="corp-summary-row"><span>Occupancy</span><strong>{form.adults} adult{form.adults === '1' ? '' : 's'}{Number(form.children) ? ', ' + form.children + ' child' + (form.children === '1' ? '' : 'ren') : ''}</strong></div><div className="corp-summary-row"><span>Rooms selected</span><strong>{selectedRoomCount}</strong></div><div className="corp-summary-row"><span>Payment</span><strong>{selectedPaymentWithDiscount.label}</strong></div></div>
        <div className="corp-side-note"><strong>Connected to Stanzel PMS</strong>Availability and reservation records are checked against the resort’s live operations system.</div>
        <div className="corp-side-note"><strong>Need help?</strong>Contact corporate reservations if you are arranging a large group or need a tailored contract.</div>
      </aside>
    </div>
    <p className="corp-footer-note">Your reservation is not confirmed until the final confirmation screen is completed.</p>
  </main>;
}

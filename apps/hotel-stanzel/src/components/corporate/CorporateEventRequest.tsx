'use client';

import { FormEvent, useState } from 'react';

type RequestType = 'HALL_ONLY' | 'HALL_AND_EVENT';

function todayValue() { return new Date().toISOString().slice(0, 10); }
function money(value: unknown) { return `NGN ${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`; }
function imageForHall(hall: any) { return hall.photos?.[0] || '/images/aerial.jpg'; }

function ChoiceIcon({ event }: { event: boolean }) {
  return <span className="corporate-event-request-choice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{event ? <><path d="M4 20V8l8-4 8 4v12" /><path d="M2 20h20M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></> : <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>}</svg></span>;
}

export default function CorporateEventRequest() {
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [guests, setGuests] = useState('50');
  const [eventName, setEventName] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [selectedHall, setSelectedHall] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset() { setRequestType(null); setDate(''); setStartTime('09:00'); setEndTime('17:00'); setGuests('50'); setEventName(''); setResults(null); setSelectedHall(null); setError(''); }
  function close() { if (!busy) { setOpen(false); reset(); } }
  function chooseType(type: RequestType) { setRequestType(type); setError(''); }
  function changeType() { setRequestType(null); setResults(null); setSelectedHall(null); setError(''); }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setResults(null); setSelectedHall(null);
    try {
      const startAt = new Date(`${date}T${startTime}`); const endAt = new Date(`${date}T${endTime}`);
      if (!date || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) throw new Error('Choose a valid future date and time range.');
      if (requestType === 'HALL_AND_EVENT' && !eventName.trim()) throw new Error('Enter an event name to continue.');
      const response = await fetch(`/api/corporate/events/availability?startAt=${encodeURIComponent(startAt.toISOString())}&endAt=${encodeURIComponent(endAt.toISOString())}&guests=${encodeURIComponent(guests)}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to search hall availability.');
      setResults(body.halls || []);
    } catch (searchError) { setError(searchError instanceof Error ? searchError.message : 'Unable to search hall availability.'); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" className="portal-primary-action corporate-event-request-launch" onClick={() => setOpen(true)}><span>Request a hall or event</span><b>→</b></button>
    {open && <div className="corporate-event-request-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="corporate-event-request-modal" role="dialog" aria-modal="true" aria-labelledby="corporate-event-request-title">
      <header className="corporate-event-request-head"><div><span className="corporate-event-request-eyebrow">Stanzel venue services</span><h2 id="corporate-event-request-title">Find the right space for your company</h2><p>Tell us what you are planning and we will show halls that fit your date, time, and guest count.</p></div><button type="button" className="corporate-wallet-modal-close" aria-label="Close request" onClick={close}>×</button></header>
      <div className="corporate-event-request-progress"><span className={!requestType ? 'is-active' : 'is-complete'}><b>01</b> Request type</span><i /> <span className={requestType ? 'is-active' : ''}><b>02</b> Find your space</span></div>
      {!requestType ? <div className="corporate-event-request-choice-grid"><button type="button" onClick={() => chooseType('HALL_ONLY')}><ChoiceIcon event={false} /><span className="corporate-event-request-choice-copy"><strong>Hall only</strong><small>Book a function space for a meeting, workshop, ceremony, or private gathering.</small><b>Continue with hall only <em>→</em></b></span></button><button type="button" onClick={() => chooseType('HALL_AND_EVENT')}><ChoiceIcon event /><span className="corporate-event-request-choice-copy"><strong>Hall + event</strong><small>Plan the venue, event details, and support services with our events team.</small><b>Continue with hall + event <em>→</em></b></span></button></div> : <><div className="corporate-event-request-step"><button type="button" onClick={changeType}>← Change request type</button><span>{requestType === 'HALL_ONLY' ? 'Hall only' : 'Hall + event'}</span></div><form className="corporate-event-request-form" onSubmit={search}><div className="corporate-event-request-fields"><label className="field-label">Event date<input className="field-input" type="date" min={todayValue()} required value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field-label">Expected guests<input className="field-input" type="number" min="1" required value={guests} onChange={(event) => setGuests(event.target.value)} /></label><label className="field-label">Start time<input className="field-input" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="field-label">End time<input className="field-input" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div>{requestType === 'HALL_AND_EVENT' && <label className="field-label">Event name<input className="field-input" required value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="e.g. Annual strategy retreat" /></label>}{error && <p className="corporate-event-request-error" role="alert">{error}</p>}<button type="submit" className="portal-primary-action corporate-event-request-search" disabled={busy}><span>{busy ? 'Checking live availability…' : 'Search available halls'}</span><b>→</b></button></form>{results && <div className="corporate-event-request-results"><div className="corporate-event-request-results-head"><div><span className="corporate-event-request-eyebrow">Available for your dates</span><h3>{results.length ? `${results.length} hall${results.length === 1 ? '' : 's'} available` : 'No halls available'}</h3></div><span>{date} · {startTime}–{endTime}</span></div>{results.length ? <div className="corporate-event-request-halls">{results.map((hall) => <button type="button" className={`corporate-event-request-hall${selectedHall?.id === hall.id ? ' is-selected' : ''}`} key={hall.id} onClick={() => setSelectedHall(hall)}><span className="corporate-event-request-hall-image"><img src={imageForHall(hall)} alt={`${hall.name} hall`} /><small>{hall.photos?.length ? 'Venue gallery' : 'Stanzel venue'}</small></span><span className="corporate-event-request-hall-copy"><strong>{hall.name}</strong><small>{hall.code} · Up to {hall.capacity.toLocaleString()} guests</small><em>{hall.amenities?.slice(0, 3).join(' · ') || 'Flexible event setup'}</em></span><span className="corporate-event-request-hall-price"><b>{hall.rate == null ? 'Rate on request' : money(hall.rate)}</b><small>{selectedHall?.id === hall.id ? 'Selected ✓' : 'Select hall →'}</small></span></button>)}</div> : <p className="corporate-event-request-empty">Try another date, time, or guest count. Our events team can also help with an alternative arrangement.</p>}{selectedHall && <div className="corporate-event-request-selected"><span>✓</span><p><strong>{selectedHall.name}</strong> is selected for your request.<small>The next step will be to send your event details to the Stanzel events team.</small></p></div>}</div>}</>}
    </section></div>}
  </>;
}

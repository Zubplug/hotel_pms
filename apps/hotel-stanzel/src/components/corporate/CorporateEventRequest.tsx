'use client';

import { FormEvent, useState } from 'react';

type RequestType = 'HALL_ONLY' | 'HALL_AND_EVENT';

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: unknown) {
  return `NGN ${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
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

  function reset() {
    setRequestType(null); setDate(''); setStartTime('09:00'); setEndTime('17:00'); setGuests('50'); setEventName(''); setResults(null); setSelectedHall(null); setError('');
  }

  function close() { if (!busy) { setOpen(false); reset(); } }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setResults(null); setSelectedHall(null);
    try {
      const startAt = new Date(`${date}T${startTime}`);
      const endAt = new Date(`${date}T${endTime}`);
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
    <button type="button" className="portal-primary-action" onClick={() => setOpen(true)}>Request a hall or event →</button>
    {open && <div className="corporate-event-request-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="corporate-event-request-modal" role="dialog" aria-modal="true" aria-labelledby="corporate-event-request-title">
      <div className="corporate-event-request-head"><div><span className="portal-section-kicker">Venue request</span><h2 id="corporate-event-request-title">Find a hall for your company</h2></div><button type="button" className="corporate-wallet-modal-close" aria-label="Close request" onClick={close}>×</button></div>
      {!requestType ? <><p className="corporate-event-request-intro">Start by telling us what you need. You can check the right space before sending a request to the events team.</p><div className="corporate-event-request-choice-grid"><button type="button" onClick={() => setRequestType('HALL_ONLY')}><strong>Hall only</strong><span>Reserve a function space for your own event setup.</span><b>Choose hall →</b></button><button type="button" onClick={() => setRequestType('HALL_AND_EVENT')}><strong>Hall + event</strong><span>Plan the venue and event details together with our team.</span><b>Plan event →</b></button></div></> : <><div className="corporate-event-request-step"><button type="button" onClick={() => { setRequestType(null); setResults(null); setSelectedHall(null); }}>← Change request type</button><span>{requestType === 'HALL_ONLY' ? 'Hall only' : 'Hall + event'}</span></div><form className="corporate-event-request-form" onSubmit={search}><div className="corporate-event-request-fields"><label className="field-label">Date<input className="field-input" type="date" min={todayValue()} required value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field-label">Expected guests<input className="field-input" type="number" min="1" required value={guests} onChange={(event) => setGuests(event.target.value)} /></label><label className="field-label">Starts<input className="field-input" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="field-label">Ends<input className="field-input" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label></div>{requestType === 'HALL_AND_EVENT' && <label className="field-label">Event name<input className="field-input" required value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="e.g. Annual strategy retreat" /></label>}{error && <p className="corporate-event-request-error" role="alert">{error}</p>}<button type="submit" className="portal-primary-action" disabled={busy}>{busy ? 'Checking availability…' : 'Search available halls →'}</button></form>{results && <div className="corporate-event-request-results"><div className="corporate-event-request-results-head"><div><span className="portal-section-kicker">Availability</span><h3>{results.length ? `${results.length} hall${results.length === 1 ? '' : 's'} available` : 'No halls available'}</h3></div><span>{date}</span></div>{results.length ? <div className="corporate-event-request-halls">{results.map((hall) => <button type="button" className={`corporate-event-request-hall${selectedHall?.id === hall.id ? ' is-selected' : ''}`} key={hall.id} onClick={() => setSelectedHall(hall)}><span><strong>{hall.name}</strong><small>{hall.code} · Capacity {hall.capacity.toLocaleString()}{hall.amenities?.length ? ` · ${hall.amenities.slice(0, 2).join(' · ')}` : ''}</small></span><b>{hall.rate == null ? 'Rate on request' : money(hall.rate)}</b></button>)}</div> : <p className="corporate-event-request-empty">Try another date, time, or guest count. The events team can also help with alternative arrangements.</p>}{selectedHall && <p className="corporate-event-request-selected">Selected: <strong>{selectedHall.name}</strong>. Your next step will be to send this request to the events team.</p>}</div>}</>}
    </section></div>}
  </>;
}

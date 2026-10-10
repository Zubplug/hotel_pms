'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DateSearchWidget() {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Today in YYYY-MM-DD local time
  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!checkIn || !checkOut) return;
    const params = new URLSearchParams({
      checkIn, checkOut,
      adults: String(adults),
      children: String(children),
    });
    router.push(`/booking/rooms?${params.toString()}`);
  }

  return (
    <form
      id="date-search-form"
      onSubmit={handleSearch}
      aria-label="Search room availability"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 'var(--space-3)',
        padding: 'var(--space-5)',
        background: 'rgba(250,248,244,0.97)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid rgba(201,169,110,0.25)',
      }}
    >
      {/* Check-in */}
      <div className="field">
        <label htmlFor="check-in-date" className="field-label" style={{ color: 'var(--color-green)' }}>
          Check-in
        </label>
        <input
          id="check-in-date"
          type="date"
          required
          min={todayStr}
          value={checkIn}
          onChange={e => {
            setCheckIn(e.target.value);
            // Auto-advance checkout if it's before new check-in
            if (checkOut && checkOut <= e.target.value) setCheckOut('');
          }}
          className="field-input"
          style={{ fontFamily: 'var(--font-sans)' }}
        />
      </div>

      {/* Check-out */}
      <div className="field">
        <label htmlFor="check-out-date" className="field-label" style={{ color: 'var(--color-green)' }}>
          Check-out
        </label>
        <input
          id="check-out-date"
          type="date"
          required
          min={checkIn || todayStr}
          value={checkOut}
          onChange={e => setCheckOut(e.target.value)}
          className="field-input"
          style={{ fontFamily: 'var(--font-sans)' }}
        />
      </div>

      {/* Adults */}
      <div className="field">
        <label htmlFor="adults-count" className="field-label" style={{ color: 'var(--color-green)' }}>
          Adults
        </label>
        <select
          id="adults-count"
          value={adults}
          onChange={e => setAdults(Number(e.target.value))}
          className="field-input"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>{n} Adult{n > 1 ? 's' : ''}</option>
          ))}
        </select>
      </div>

      {/* Children */}
      <div className="field">
        <label htmlFor="children-count" className="field-label" style={{ color: 'var(--color-green)' }}>
          Children
        </label>
        <select
          id="children-count"
          value={children}
          onChange={e => setChildren(Number(e.target.value))}
          className="field-input"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {[0, 1, 2, 3, 4].map(n => (
            <option key={n} value={n}>{n === 0 ? 'None' : `${n} Child${n > 1 ? 'ren' : ''}`}</option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <div className="field" style={{ justifyContent: 'flex-end' }}>
        <label className="field-label" style={{ visibility: 'hidden' }}>Search</label>
        <button
          id="search-availability-btn"
          type="submit"
          className="btn btn-primary"
          disabled={!checkIn || !checkOut}
          style={{ width: '100%', height: '50px' }}
        >
          Check Availability
        </button>
      </div>
    </form>
  );
}

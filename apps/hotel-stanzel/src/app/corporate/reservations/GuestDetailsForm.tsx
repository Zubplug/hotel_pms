'use client';

import { FormEvent, useState } from 'react';

export default function GuestDetailsForm({ reservationId, guest, editable }: { reservationId: string; guest?: { firstName?: string; lastName?: string; email?: string; phone?: string | null; country?: string | null }; editable: boolean }) {
  const [form, setForm] = useState({ firstName: guest?.firstName || '', lastName: guest?.lastName || '', email: guest?.email || '', phone: guest?.phone || '', country: guest?.country || '' });
  const [state, setState] = useState('');
  if (!editable) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Front Desk manages guest changes</span>;
  async function save(event: FormEvent) {
    event.preventDefault();
    setState('Saving…');
    const response = await fetch(`/api/corporate/booking/${encodeURIComponent(reservationId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guest: { ...form, phone: form.phone || undefined, country: form.country || undefined } }) });
    const body = await response.json().catch(() => ({}));
    setState(response.ok ? 'Guest details saved' : body.error || 'Could not save guest details');
  }
  return <form onSubmit={save} style={{ display: 'grid', gap: 7, minWidth: 240 }}>
    <input aria-label="Guest first name" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="First name" />
    <input aria-label="Guest last name" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Last name" />
    <input aria-label="Guest email" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" />
    <input aria-label="Guest phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone (optional)" />
    <button type="submit" style={{ justifySelf: 'start' }}>Save guest</button>
    {state && <small style={{ color: state === 'Guest details saved' ? 'var(--success, #16845b)' : 'var(--text-muted)' }}>{state}</small>}
  </form>;
}

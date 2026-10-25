'use client';

import { FormEvent, useState } from 'react';

type Guest = { firstName?: string; lastName?: string; email?: string; phone?: string | null; country?: string | null };

export default function GuestDetailsForm({ reservationId, guest, editable }: { reservationId: string; guest?: Guest; editable: boolean }) {
  const [form, setForm] = useState({ firstName: guest?.firstName || '', lastName: guest?.lastName || '', email: guest?.email || '', phone: guest?.phone || '', country: guest?.country || '' });
  const [savedGuest, setSavedGuest] = useState<Guest | undefined>(guest);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState('');
  const isPlaceholder = !savedGuest?.firstName || savedGuest.firstName === 'Corporate' || String(savedGuest.lastName || '').startsWith('Guest') || savedGuest.email === 'corporate.booking@stanzelgrandresort.com';
  const displayName = `${savedGuest?.firstName || ''} ${savedGuest?.lastName || ''}`.trim() || 'Guest details pending';

  async function save(event: FormEvent) {
    event.preventDefault();
    setState('Saving…');
    const response = await fetch(`/api/corporate/booking/${encodeURIComponent(reservationId)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guest: { ...form, phone: form.phone || undefined, country: form.country || undefined } }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setSavedGuest(form);
      setState('Guest details saved');
      setEditing(false);
    } else {
      setState(body.error || 'Could not save guest details');
    }
  }

  if (!editing) return <div className="reservation-guest-summary"><div className="reservation-guest-avatar">{displayName.slice(0, 1).toUpperCase()}</div><div className="reservation-guest-summary-copy"><div className="reservation-guest-summary-title"><strong>{displayName}</strong>{isPlaceholder && <span>Placeholder details</span>}</div><p>{savedGuest?.email || 'No email recorded'}{savedGuest?.phone ? ` · ${savedGuest.phone}` : ''}</p>{savedGuest?.country && <small>{savedGuest.country}</small>}</div>{editable ? <button type="button" className="reservation-guest-edit-button" onClick={() => { setState(''); setEditing(true); }}>Edit guest details <span aria-hidden="true">↗</span></button> : <span className="reservation-guest-locked">Managed by front desk</span>}</div>;

  return <form onSubmit={save} className="reservation-guest-edit-form"><div className="reservation-guest-edit-heading"><div><strong>{isPlaceholder ? 'Replace placeholder details' : 'Edit guest details'}</strong><p>Add the primary guest who will occupy this room.</p></div><button type="button" className="reservation-guest-cancel" onClick={() => setEditing(false)}>Cancel</button></div><div className="reservation-guest-edit-grid"><label>First name<input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label>Last name<input required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label><label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone <span>(optional)</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Country <span>(optional)</span><input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label></div>{state && <small className={state === 'Guest details saved' ? 'reservation-guest-success' : 'reservation-guest-error'}>{state}</small>}<button type="submit" className="portal-primary-action" disabled={state === 'Saving…'}>{state === 'Saving…' ? 'Saving details…' : 'Save guest details'}</button></form>;
}

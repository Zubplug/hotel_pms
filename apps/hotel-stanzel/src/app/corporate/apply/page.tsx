'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { value: string; label: string; description?: string };

const paymentOptions: Option[] = [
  { value: 'PAY_LATER', label: 'Pay later', description: 'Subject to corporate approval' },
  { value: 'FULL', label: 'Pay in full', description: 'Settle the booking before arrival' },
  { value: 'DEPOSIT', label: 'Pay a deposit', description: 'Deposit terms confirmed by Stanzel' },
];

const countryOptions: Option[] = [
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Other', label: 'Other country' },
];

function SearchableSelect({ name, label, options, defaultValue, hint }: { name: string; label: string; options: Option[]; defaultValue: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [value, setValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) || options[0];
  const filtered = options.filter((option) => `${option.label} ${option.description || ''}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function close(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return <div ref={rootRef} style={{ position: 'relative' }}>
    <label className="field-label">{label}{hint && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {hint}</span>}</label>
    <input type="hidden" name={name} value={value} required />
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} style={{ width: '100%', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: 'var(--color-white)', border: `1px solid ${open ? 'var(--color-gold-dark)' : 'var(--border)'}`, borderRadius: 8, padding: '12px 14px', color: 'var(--text)', font: 'inherit' }}>
      <span>{selected.label}</span>
      <span aria-hidden="true" style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : undefined }}>⌄</span>
    </button>
    {open && <div role="listbox" aria-label={label} style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 6px)', background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 8 }}>
      <input autoFocus aria-label={`Search ${label.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="field-input" style={{ marginBottom: 6 }} />
      <div style={{ maxHeight: 210, overflowY: 'auto' }}>
        {filtered.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { setValue(option.value); setQuery(''); setOpen(false); }} style={{ width: '100%', display: 'block', textAlign: 'left', background: option.value === value ? 'var(--color-ivory-dark)' : 'transparent', border: 0, borderRadius: 8, padding: '10px 12px', color: 'var(--text)', font: 'inherit' }}><strong style={{ display: 'block', fontSize: 13 }}>{option.label}</strong>{option.description && <small style={{ color: 'var(--text-muted)' }}>{option.description}</small>}</button>)}
        {!filtered.length && <p style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 13 }}>No matches found.</p>}
      </div>
    </div>}
  </div>;
}

export default function CorporateApplyPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch('/api/corporate/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error || 'Unable to start corporate booking.');
    else router.push(result.redirectTo || '/corporate/book?mode=application');
    setBusy(false);
  }

  return <div style={{ maxWidth: 1040 }}>
    <div className="corporate-hero" style={{ marginBottom: 24 }}>
      <div className="corporate-hero-copy">
        <p className="eyebrow" style={{ color: 'var(--color-gold-light)' }}>Stanzel Grand Resort · Corporate services</p>
        <h2>Make every business stay feel considered.</h2>
        <p>Tell us about your organisation and we will help you arrange dependable accommodation, preferred rates and a seamless arrival experience for your guests.</p>
        <div className="corporate-trust-row"><span>✓ Contract-rate pricing</span><span>✓ Secure booking</span><span>✓ Front desk ready</span></div>
      </div>
      <div className="corporate-hero-card">
        <p className="eyebrow">Step 1 of 2 · Corporate application</p>
        <h3>Tell us about your organisation</h3>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14 }}>Your details create a secure, short-lived booking workspace. A permanent PMS corporate account is created or reused only after the booking is approved or settled.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          <div className="corporate-form-grid">
            <label className="field-label">Company name<input className="field-input" name="companyName" required minLength={2} autoComplete="organization" /></label>
            <label className="field-label">Contact person<input className="field-input" name="contactPerson" required minLength={2} autoComplete="name" /></label>
          </div>
          <div className="corporate-form-grid">
            <label className="field-label">Corporate email<input className="field-input" name="contactEmail" type="email" required autoComplete="email" /></label>
            <label className="field-label">Phone number<input className="field-input" name="contactPhone" type="tel" required minLength={7} autoComplete="tel" placeholder="+234 800 000 0000" /></label>
          </div>
          <label className="field-label">Business address<input className="field-input" name="companyAddress" required minLength={5} autoComplete="street-address" placeholder="Street address, building or suite" /></label>
          <div className="corporate-form-grid">
            <label className="field-label">City<input className="field-input" name="companyCity" required minLength={2} autoComplete="address-level2" /></label>
            <SearchableSelect name="companyCountry" label="Country" options={countryOptions} defaultValue="Nigeria" />
          </div>
          <div className="corporate-form-grid">
            <SearchableSelect name="paymentMode" label="Payment arrangement" options={paymentOptions} defaultValue="PAY_LATER" />
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>All Stanzel corporate applications are currently quoted and settled in Nigerian Naira.</p></div>
          </div>
          <input type="hidden" name="currency" value="NGN" />
          {error && <p role="alert" style={{ color: '#b42318', fontSize: 13, margin: 0 }}>{error}</p>}
          <button className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 4 }}>{busy ? 'Opening secure booking…' : 'Continue to room selection'}</button>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>Your information is used to prepare this corporate booking and connect it to Stanzel’s PMS workflow.</p>
        </form>
      </div>
    </div>
    <div className="corporate-step-grid"><div className="corporate-step"><span className="corporate-step-number">1</span><h3>Share your details</h3><p>Give us the organisation and contact information needed to support your stay.</p></div><div className="corporate-step"><span className="corporate-step-number">2</span><h3>Review your rate</h3><p>Availability and corporate pricing come from LodgeCore’s protected Corporate API.</p></div><div className="corporate-step"><span className="corporate-step-number">3</span><h3>Reserve with confidence</h3><p>Your reservation is created in the same PMS workflow used by Stanzel front desk.</p></div></div>
  </div>;
}

'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CorporateSetupPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password.length < 8 || password !== confirmation) { setError(password.length < 8 ? 'Use at least 8 characters.' : 'Passwords do not match.'); return; }
    setBusy(true);
    const response = await fetch('/api/corporate-portal/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'Unable to save your password.'); else router.push(body.redirectTo || '/corporate/dashboard');
    setBusy(false);
  }

  return <div style={{ maxWidth: 500, margin: '0 auto', background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 22, padding: 'clamp(26px, 5vw, 42px)', boxShadow: 'var(--shadow-md)' }}><p className="eyebrow">Secure account setup</p><h2 style={{ marginTop: 8 }}>Create your portal password</h2><p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 10 }}>Your secure recovery link has verified your account. Set a password to use for future corporate portal sign-ins.</p><form onSubmit={submit} style={{ display: 'grid', gap: 15, marginTop: 24 }}><label className="field-label">New password<input className="field-input" type="password" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ marginTop: 8 }} /></label><label className="field-label">Confirm password<input className="field-input" type="password" minLength={8} required autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} style={{ marginTop: 8 }} /></label>{error && <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Saving securely…' : 'Save password and continue'}</button></form></div>;
}

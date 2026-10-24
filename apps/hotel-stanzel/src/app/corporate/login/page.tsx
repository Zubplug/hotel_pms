'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CorporateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const response = await fetch('/api/corporate-portal/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'Unable to sign in.');
    else router.push(body.redirectTo || '/corporate');
    setBusy(false);
  }

  async function requestRecovery() {
    setRecoveryBusy(true); setError(''); setMessage('');
    const response = await fetch('/api/corporate-portal/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, magicLink: true }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'Unable to send the recovery link.');
    else setMessage(body.message || 'Check your email for a secure recovery link.');
    setRecoveryBusy(false);
  }

  return <div className="corporate-login-grid" style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(340px, 1.1fr)', background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 24, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
    <div style={{ background: 'linear-gradient(145deg, var(--color-green-dark), var(--color-green))', padding: 'clamp(28px, 5vw, 56px)', color: 'var(--color-ivory)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 500 }}>
      <div><p className="eyebrow" style={{ color: 'var(--color-gold-light)' }}>Stanzel Grand Resort</p><h2 style={{ color: 'var(--color-ivory)', marginTop: 14 }}>Your corporate stay, all in one place.</h2><p style={{ color: 'rgba(250,248,244,0.72)', lineHeight: 1.75, marginTop: 18 }}>Manage reservations, approved rates and your corporate City Ledger relationship through a secure Stanzel workspace.</p></div>
      <div style={{ display: 'grid', gap: 12, marginTop: 40 }}><span style={{ color: 'rgba(250,248,244,0.78)', fontSize: 13 }}>✓ One connected PMS record</span><span style={{ color: 'rgba(250,248,244,0.78)', fontSize: 13 }}>✓ Secure account access</span><span style={{ color: 'rgba(250,248,244,0.78)', fontSize: 13 }}>✓ Front desk-ready reservations</span></div>
    </div>
    <div style={{ padding: 'clamp(28px, 5vw, 54px)' }}>
      <p className="eyebrow">Corporate portal</p><h1 style={{ marginTop: 8 }}>Welcome back</h1><p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14, marginTop: 10 }}>Sign in with the corporate email and password issued for your approved Stanzel account.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 16, marginTop: 28 }}><label className="field-label" htmlFor="corporate-email">Corporate email<input id="corporate-email" className="field-input" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ marginTop: 8 }} /></label><label className="field-label" htmlFor="corporate-password">Password<input id="corporate-password" className="field-input" type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ marginTop: 8 }} /></label>{message && <p role="status" style={{ color: '#176b4d', fontSize: 13, margin: 0 }}>{message}</p>}{error && <p role="alert" style={{ color: '#b42318', fontSize: 13, margin: 0 }}>{error}</p>}<button className="btn btn-primary" disabled={busy || recoveryBusy} style={{ width: '100%', marginTop: 4 }}>{busy ? 'Signing in…' : 'Sign in securely'}</button></form>
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 20 }}><p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>First-time access, a legacy account, or a forgotten password?</p><button type="button" onClick={requestRecovery} disabled={busy || recoveryBusy || !email} className="btn btn-outline-dark" style={{ width: '100%', marginTop: 10 }}>{recoveryBusy ? 'Sending secure link…' : 'Email me a recovery link'}</button></div>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginTop: 22 }}>Only active corporate accounts assigned to Stanzel Grand Resort can access this portal.</p><Link href="/contact" className="btn btn-outline-dark" style={{ marginTop: 12, width: '100%' }}>Contact the resort team</Link>
    </div>
    <style>{`@media (max-width: 760px) { .corporate-login-grid { grid-template-columns: 1fr !important; } }`}</style>
  </div>;
}

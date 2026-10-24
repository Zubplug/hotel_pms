'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function CorporateLoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const response = await fetch('/api/corporate-portal/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setError(body.error || 'Unable to send the login link.');
    else setMessage(body.message || 'Check your email for a secure login link.');
    setBusy(false);
  }
  return <><Header /><main style={{ minHeight: '65vh', padding: 'calc(var(--nav-height) + 60px) 20px 70px', background: 'var(--color-ivory-dark)' }}><div style={{ maxWidth: 470, margin: '0 auto', background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 20, padding: 34 }}><p className="eyebrow">Corporate services</p><h1>Sign in to your workspace</h1><p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14 }}>Enter the contact email registered on your approved Stanzel corporate account. We will send a secure one-time sign-in link.</p><form onSubmit={submit} style={{ marginTop: 25 }}><label className="field-label" htmlFor="corporate-email">Corporate contact email</label><input id="corporate-email" name="email" className="field-input" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ marginTop: 8 }} />{message && <p role="status" style={{ color: '#176b4d', fontSize: 13, marginTop: 12 }}>{message}</p>}{error && <p role="alert" style={{ color: '#b42318', fontSize: 13, marginTop: 12 }}>{error}</p>}<button className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 18 }}>{busy ? 'Sending secure link…' : 'Email me a sign-in link'}</button></form><p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>Only active corporate accounts assigned to Stanzel Grand Resort can access this portal.</p><Link href="/contact" className="btn btn-outline-dark" style={{ marginTop: 10 }}>Contact the resort</Link></div></main><Footer /></>;
}

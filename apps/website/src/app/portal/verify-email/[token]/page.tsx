'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');
  useEffect(() => { void params.then(({ token }) => fetch('/api/portal/verify-email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }).then(async response => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Verification failed.'); setState('done'); setMessage('Email verified. You can now sign in and start your 7-day trial.'); }).catch(error => { setState('error'); setMessage(error instanceof Error ? error.message : 'Verification failed.'); })); }, [params]);
  return <main className="site-shell" style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}><div style={{ width: '100%', maxWidth: 460, padding: 40, textAlign: 'center', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', background: 'var(--bg-card)' }}><Link href="/" className="brand">Lodge<span className="brand-core">Core</span></Link><div className="section-kicker" style={{ marginTop: 36 }}>Customer portal</div><h1 style={{ margin: '12px 0', fontSize: 30 }}>{state === 'loading' ? 'Verifying email…' : state === 'done' ? 'Email verified' : 'Verification unavailable'}</h1><p style={{ color: state === 'error' ? 'var(--red)' : 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>{message}</p>{state === 'done' && <Link href="/portal/login?callbackUrl=%2Fportal%2Fsubscription" className="btn btn-primary" style={{ marginTop: 24 }}>Continue to portal →</Link>}{state === 'error' && <Link href="/portal/register" className="btn btn-outline" style={{ marginTop: 24 }}>Return to registration</Link>}</div></main>;
}

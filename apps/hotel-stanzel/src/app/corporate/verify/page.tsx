'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function CorporateVerifyPage() {
  const params = useSearchParams();
  const [error, setError] = useState('');
  useEffect(() => {
    const token = params.get('token');
    if (!token) { setError('This login link is incomplete.'); return; }
    fetch('/api/corporate-portal/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || 'This login link is invalid or expired.'); return; }
      window.location.href = body.redirectTo || '/corporate';
    }).catch(() => setError('Corporate portal is temporarily unavailable.'));
  }, [params]);
  return <><Header /><main style={{ minHeight: '65vh', padding: 'calc(var(--nav-height) + 60px) 20px 70px', background: 'var(--color-ivory-dark)' }}><div style={{ maxWidth: 470, margin: '0 auto', background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 20, padding: 34, textAlign: 'center' }}><p className="eyebrow">Corporate services</p><h1>{error ? 'Sign-in link unavailable' : 'Opening your workspace…'}</h1><p style={{ color: error ? '#b42318' : 'var(--text-muted)', lineHeight: 1.7, fontSize: 14 }}>{error || 'Please wait while we verify your secure one-time link.'}</p></div></main><Footer /></>;
}

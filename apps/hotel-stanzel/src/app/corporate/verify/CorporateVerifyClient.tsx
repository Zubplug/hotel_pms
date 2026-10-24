'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Props = {
  cardStyle: React.CSSProperties;
};

export default function CorporateVerifyClient({ cardStyle }: Props) {
  const params = useSearchParams();
  const token = params.get('token');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This login link is incomplete.');
      return;
    }

    fetch('/api/corporate-portal/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error || 'This login link is invalid or expired.');
          return;
        }
        window.location.href = body.redirectTo || '/corporate';
      })
      .catch(() => setError('Corporate portal is temporarily unavailable.'));
  }, [token]);

  return (
    <div style={cardStyle}>
      <p className="eyebrow">Corporate services</p>
      <h1>{error ? 'Sign-in link unavailable' : 'Opening your workspace…'}</h1>
      <p style={{ color: error ? '#b42318' : 'var(--text-muted)', lineHeight: 1.7, fontSize: 14 }}>
        {error || 'Please wait while we verify your secure one-time link.'}
      </p>
    </div>
  );
}

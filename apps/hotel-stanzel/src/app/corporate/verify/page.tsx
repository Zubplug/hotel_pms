import { Suspense } from 'react';
import CorporateVerifyClient from './CorporateVerifyClient';

const cardStyle = {
  maxWidth: 470,
  margin: '0 auto',
  background: 'var(--color-white)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: 34,
  textAlign: 'center' as const,
};

function LoadingCard() {
  return (
    <div style={cardStyle}>
      <p className="eyebrow">Corporate services</p>
      <h1>Opening your workspace…</h1>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14 }}>
        Please wait while we verify your secure one-time link.
      </p>
    </div>
  );
}

export default function CorporateVerifyPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <CorporateVerifyClient cardStyle={cardStyle} />
    </Suspense>
  );
}

import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
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
    <>
      <Header />
      <main style={{ minHeight: '65vh', padding: 'calc(var(--nav-height) + 60px) 20px 70px', background: 'var(--color-ivory-dark)' }}>
        <Suspense fallback={<LoadingCard />}>
          <CorporateVerifyClient cardStyle={cardStyle} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

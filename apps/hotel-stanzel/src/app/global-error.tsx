'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Stanzel] Unhandled error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#faf8f4', margin: 0, padding: 0 }}>
        <main style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '1rem' }}>
              Something went wrong
            </p>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2rem, 5vw, 3rem)', color: '#1a3c34', marginBottom: '1rem', fontWeight: 400 }}>
              An Unexpected Error Occurred
            </h1>
            <p style={{ color: '#6b6b6b', maxWidth: '400px', margin: '0 auto 2rem', lineHeight: 1.7 }}>
              We apologise for the inconvenience. Our team has been notified. Please try refreshing the page or returning to the homepage.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.875rem 2rem', background: '#c9a96e', color: '#102620',
                  border: '2px solid #c9a96e', borderRadius: '2px',
                  fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.06em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <a
                href="/"
                style={{
                  padding: '0.875rem 2rem', background: 'transparent', color: '#1a3c34',
                  border: '2px solid #1a3c34', borderRadius: '2px',
                  fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.06em',
                  textTransform: 'uppercase', textDecoration: 'none', display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Return Home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

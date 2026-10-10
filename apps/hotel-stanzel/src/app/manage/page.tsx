'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

function ManagePageContent() {
  const params = useSearchParams();
  const tokenFromUrl = params.get('token') ?? '';
  const [cancelToken, setCancelToken] = useState(tokenFromUrl);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'confirming' | 'cancelling' | 'cancelled' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (cancelToken.trim().length < 32) {
      setErrorMsg('Please enter a valid cancellation token (found in your booking confirmation email).');
      return;
    }
    setErrorMsg('');
    setStatus('confirming');
  }

  async function handleCancel() {
    setStatus('cancelling'); setErrorMsg('');
    try {
      const res = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelToken: cancelToken.trim(), reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? 'Could not cancel this reservation.');
        setStatus('confirming'); return;
      }
      setResult(data); setStatus('cancelled');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('confirming');
    }
  }

  return (
    <>
      <Header />
      <main id="main-content" style={{ paddingTop: 'calc(var(--nav-height) + var(--space-16))', minHeight: '70vh', background: 'var(--color-ivory-dark)' }}>
        <div className="container" style={{ maxWidth: '640px', paddingBlock: 'var(--space-12)' }}>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Booking Management</p>
          <h1 style={{ marginBottom: 'var(--space-4)' }}>Manage Your Reservation</h1>
          <span className="gold-divider" />
          <p style={{ marginBottom: 'var(--space-10)' }}>
            Enter your cancellation token to manage or cancel your booking. You can find this token in your booking confirmation email.
          </p>

          {/* Cancelled state */}
          {status === 'cancelled' && result && (
            <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgb(26 60 52 / 0.08)', border: '3px solid var(--color-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ marginBottom: 'var(--space-3)' }}>Reservation Cancelled</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
                Booking <strong>{result.confirmationNumber}</strong> has been cancelled.
              </p>
              {result.penaltyAmount > 0 && (
                <div style={{ padding: 'var(--space-4)', background: 'rgb(201 169 110 / 0.1)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-5)', border: '1px solid rgba(201,169,110,0.25)' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gold-dark)', fontWeight: 600 }}>{result.penaltyDescription}</p>
                </div>
              )}
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-8)' }}>{result.refundNote}</p>
              <Link href="/" className="btn btn-secondary">Return to Homepage</Link>
            </div>
          )}

          {/* Confirm cancellation */}
          {status === 'confirming' && (
            <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', border: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-5)' }}>Confirm Cancellation</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--text-sm)' }}>
                You are about to cancel a reservation. Please note that a cancellation penalty may apply depending on the cancellation policy of your rate plan and how close to check-in you are cancelling.
              </p>

              <div className="field" style={{ marginBottom: 'var(--space-5)' }}>
                <label htmlFor="cancel-reason" className="field-label">Reason for Cancellation (optional)</label>
                <textarea id="cancel-reason" className="field-input" rows={3} value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Travel plans changed, illness, etc."
                  style={{ resize: 'vertical' }} />
              </div>

              {errorMsg && (
                <div style={{ padding: 'var(--space-4)', background: 'rgb(192 57 43 / 0.08)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(192,57,43,0.2)', marginBottom: 'var(--space-5)' }}>
                  <p style={{ color: '#c0392b', fontSize: 'var(--text-sm)' }}>{errorMsg}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <button onClick={handleCancel} id="confirm-cancel-btn" className="btn btn-primary"
                  style={{ flex: 1, background: '#c0392b', borderColor: '#c0392b' }}>
                  Confirm Cancellation
                </button>
                <button onClick={() => setStatus('idle')} className="btn btn-outline-dark" style={{ flex: 1 }}>
                  Go Back
                </button>
              </div>
            </div>
          )}

          {/* Cancelling spinner */}
          {status === 'cancelling' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
              <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--color-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--space-4)' }} />
              <p style={{ color: 'var(--text-muted)' }}>Processing cancellation…</p>
            </div>
          )}

          {/* Token entry */}
          {status === 'idle' && (
            <form id="manage-booking-form" onSubmit={handleLookup}
              style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', border: '1px solid var(--border)' }}>
              <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
                <label htmlFor="cancel-token" className="field-label">Cancellation Token <span style={{ color: 'var(--color-gold)' }}>*</span></label>
                <input id="cancel-token" type="text" className="field-input"
                  value={cancelToken} onChange={e => setCancelToken(e.target.value)}
                  placeholder="Paste your cancellation token here"
                  autoComplete="off" required />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
                  Your cancellation token was included in your booking confirmation email from Stanzel Grand Resort.
                </p>
              </div>
              {errorMsg && <p style={{ color: '#c0392b', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{errorMsg}</p>}
              <button id="lookup-booking-btn" type="submit" className="btn btn-secondary btn-lg" style={{ width: '100%' }}>
                Continue
              </button>
              <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Having trouble?{' '}
                <Link href="/contact" style={{ color: 'var(--color-green)', fontWeight: 600 }}>Contact our team</Link>
              </p>
            </form>
          )}
        </div>
      </main>
      <Footer />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

export default function ManagePage() {
  return (
    <Suspense fallback={
      <div style={{ paddingTop: 'calc(var(--nav-height) + 4rem)', textAlign: 'center', minHeight: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--color-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ManagePageContent />
    </Suspense>
  );
}

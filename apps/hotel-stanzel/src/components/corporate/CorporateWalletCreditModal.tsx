'use client';

import { useEffect, useState } from 'react';

export default function CorporateWalletCreditModal() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, busy]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/corporate/wallet', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': `wallet-${crypto.randomUUID()}` },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.authorizationUrl) {
        setError(body.error || 'Could not start the wallet credit payment.');
        setBusy(false);
        return;
      }
      window.location.assign(body.authorizationUrl);
    } catch {
      setError('We could not connect to the payment service. Please try again.');
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="portal-secondary-action" onClick={() => { setError(null); setOpen(true); }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6.5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h13" /><path d="M16 13h5M17 13a1 1 0 1 0 0 2 1 1 0 0 0-0-2Z" /></svg>
      Credit corporate wallet
    </button>
    {open && <div className="corporate-wallet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="corporate-wallet-modal" role="dialog" aria-modal="true" aria-labelledby="corporate-wallet-title">
        <div className="corporate-wallet-modal-head"><div><span className="portal-section-kicker">City Ledger</span><h2 id="corporate-wallet-title">Credit corporate wallet</h2></div><button type="button" className="corporate-wallet-modal-close" aria-label="Close wallet credit dialog" disabled={busy} onClick={() => setOpen(false)}>×</button></div>
        <p className="corporate-wallet-modal-intro">Choose the amount to add to your company’s corporate wallet. The payment will be processed securely through the property’s configured gateway.</p>
        <form onSubmit={submit} className="corporate-wallet-modal-form">
          <label className="field-label">Credit amount<div className="corporate-wallet-amount-field"><span>NGN</span><input autoFocus className="field-input" name="amount" type="number" min="1" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div></label>
          {error && <p className="corporate-wallet-modal-error" role="alert">{error}</p>}
          <div className="corporate-wallet-modal-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Opening secure payment…' : 'Proceed to payment →'}</button></div>
        </form>
      </section>
    </div>}
  </>;
}

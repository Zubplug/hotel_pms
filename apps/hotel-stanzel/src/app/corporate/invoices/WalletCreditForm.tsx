'use client';

import { useState } from 'react';

export default function WalletCreditForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/corporate/wallet', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-idempotency-key': `wallet-${crypto.randomUUID()}` },
      body: JSON.stringify({ email: String(form.get('email') || ''), amount: Number(form.get('amount')) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.authorizationUrl) {
      setError(body.error || 'Could not start the wallet credit payment.');
      setBusy(false);
      return;
    }
    window.location.assign(body.authorizationUrl);
  }
  return <section className="card" style={{ marginTop: 18 }}><h2>Credit corporate wallet</h2><p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>Credit your corporate City Ledger once. The PMS will automatically apply the payment to outstanding invoices; any remainder stays as advance credit.</p><form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 520, marginTop: 16 }}><label className="field-label">Payment email<input className="field-input" name="email" type="email" required /></label><label className="field-label">Amount<input className="field-input" name="amount" type="number" min="1" step="0.01" required /></label>{error && <p role="alert" style={{ color: '#b42318', fontSize: 13, margin: 0 }}>{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Opening secure payment…' : 'Credit wallet'}</button></form></section>;
}

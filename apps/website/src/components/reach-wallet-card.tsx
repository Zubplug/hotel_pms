"use client";

import { useEffect, useState } from "react";

type Debt = { property: { name: string }; outstandingAmount: number; suspensionThreshold: number; status: string };
type Wallet = { balance: number; currency: string; status: string };

const QUICK_AMOUNTS = [50000, 100000, 250000];

export function ReachWalletCard() {
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, currency: "NGN", status: "ACTIVE" });
  const [debts, setDebts] = useState<Debt[]>([]);
  const [amount, setAmount] = useState("100000");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/portal/reach-wallet", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setWallet(data.wallet);
    setDebts(data.debts || []);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  async function fund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/portal/reach-wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start funding");
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start funding");
      setBusy(false);
    }
  }

  const balance = `${wallet.currency} ${wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return <>
    <section className="reach-wallet-card">
      <div className="reach-wallet-topline"><div className="reach-wallet-mark">R</div><div className="reach-wallet-kicker">LodgeCore Reach <span><i /> Wallet active</span></div></div>
      <div className="reach-wallet-body"><div><h2>Keep your properties running smoothly.</h2><p>Fund your Reach wallet once and platform fees are settled automatically across your connected properties.</p></div><div className="reach-wallet-balance"><span>Available balance</span><strong>{balance}</strong><small>Secure payments via Flutterwave</small></div></div>
      <div className="reach-wallet-footer"><span>{debts.length ? `${debts.length} property fee issue${debts.length === 1 ? "" : "s"} need attention` : "No property fee issues to resolve"}</span><button className="btn btn-primary btn-sm" onClick={() => { setMessage(null); setOpen(true); }}>Fund wallet <span aria-hidden="true">→</span></button></div>
      {debts.length > 0 && <div className="reach-wallet-debts">{debts.map((debt) => <div key={debt.property.name}><span className={debt.status === "SUSPENDED" ? "is-danger" : ""}>{debt.property.name} · {debt.status}</span><strong>{wallet.currency} {debt.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>)}</div>}
    </section>
    {open && <div className="reach-wallet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="reach-wallet-modal" role="dialog" aria-modal="true" aria-labelledby="reach-wallet-title">
        <div className="reach-wallet-modal-head"><div><span className="portal-page-kicker">LodgeCore Reach</span><h2 id="reach-wallet-title">Fund your wallet</h2></div><button type="button" className="reach-wallet-close" onClick={() => setOpen(false)} disabled={busy} aria-label="Close dialog">×</button></div>
        <p className="reach-wallet-modal-copy">Choose an amount to add to your organisation wallet. You’ll complete the payment securely on Flutterwave.</p>
        <form onSubmit={fund} className="reach-wallet-form"><label className="reach-wallet-field">Amount to add<div><span>{wallet.currency}</span><input autoFocus required min="1" step="0.01" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div></label><div className="reach-wallet-presets" aria-label="Suggested amounts">{QUICK_AMOUNTS.map((value) => <button type="button" key={value} onClick={() => setAmount(String(value))}>{wallet.currency} {value.toLocaleString()}</button>)}</div>{message && <p className="reach-wallet-error" role="alert">{message}</p>}<p className="reach-wallet-secure"><span>✓</span> Funds are credited after payment confirmation.</p><div className="reach-wallet-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button><button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Opening secure payment…" : "Continue to payment →"}</button></div></form>
      </section>
    </div>}
  </>;
}

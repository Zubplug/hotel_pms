"use client";

import { useEffect, useState } from "react";

type Debt = { property: { name: string }; outstandingAmount: number; suspensionThreshold: number; status: string };
type Wallet = { balance: number; currency: string; status: string };

export function ReachWalletCard() {
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, currency: "NGN", status: "ACTIVE" });
  const [debts, setDebts] = useState<Debt[]>([]);
  const [amount, setAmount] = useState("50000");
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

  async function fund() {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/portal/reach-wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start funding");
      window.location.assign(data.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start funding"); setBusy(false); }
  }

  return <section className="portal-card" style={{ marginBottom: 24, borderColor: "rgba(0,212,232,.3)", background: "linear-gradient(135deg, rgba(0,212,232,.08), transparent 55%)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
      <div>
        <div className="portal-page-kicker">LodgeCore Reach</div>
        <div className="portal-card-title" style={{ fontSize: 20 }}>Platform-fee wallet</div>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6, maxWidth: 560 }}>Fund once through Flutterwave. Reach platform fees are paid from this organization wallet for each property; unpaid property debt can suspend that property until cleared.</p>
      </div>
      <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: "var(--text-muted)" }}>Available balance</div><div style={{ fontSize: 26, fontWeight: 800, color: "#00d4e8" }}>{wallet.currency} {wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
    </div>
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
      <input className="input" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" aria-label="Funding amount" style={{ maxWidth: 160 }} />
      <button className="btn btn-primary btn-sm" onClick={() => void fund()} disabled={busy}>{busy ? "Opening Flutterwave…" : "Fund wallet →"}</button>
      {message && <span role="alert" style={{ color: "var(--danger, #ff5f72)", fontSize: 12 }}>{message}</span>}
    </div>
    {debts.length > 0 && <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}><div className="portal-card-title" style={{ fontSize: 13, marginBottom: 8 }}>Property fee debt</div>{debts.map((debt) => <div key={debt.property.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "6px 0", color: debt.status === "SUSPENDED" ? "#ff5f72" : "var(--text-secondary)" }}><span>{debt.property.name} · {debt.status}</span><span>{wallet.currency} {debt.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {debt.suspensionThreshold.toLocaleString()}</span></div>)}</div>}
  </section>;
}

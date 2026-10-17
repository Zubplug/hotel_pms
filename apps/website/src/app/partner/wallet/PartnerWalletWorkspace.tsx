"use client";
import { FormEvent, useMemo, useState } from "react";

type Wallet = { id: string; propertyId: string; propertyName: string; currency: string; availableBalance: number; minimumPayout: number };

export function PartnerWalletWorkspace({ wallets }: { wallets: Wallet[] }) {
  const [selectedPropertyId, setSelectedPropertyId] = useState(wallets[0]?.propertyId || "");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => wallets.find((wallet) => wallet.propertyId === selectedPropertyId) || wallets[0], [wallets, selectedPropertyId]);
  async function withdraw(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/partner/wallet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: Number(amount), propertyId: selected?.propertyId }) });
    const data = await response.json().catch(() => ({})); setMessage(data.message || data.error || (response.ok ? "Withdrawal submitted." : "Unable to submit withdrawal.")); setBusy(false);
  }
  return <>
    <div className="reach-kpi-grid">{wallets.map((wallet) => <div className="reach-kpi" key={wallet.id}><div className="reach-kpi-icon green">₦</div><div><p>{wallet.propertyName}</p><strong>{wallet.currency} {wallet.availableBalance.toLocaleString("en-NG")}</strong><small>Available for this property</small></div></div>)}</div>
    {!wallets.length && <div className="reach-card reach-empty"><strong>No property wallet balances yet</strong><p>Payable commissions will appear here after an eligible booking is approved.</p></div>}
    {!!selected && <div className="reach-card"><div className="reach-card-head"><div><h2>Request a payout</h2><p>Withdraw only from {selected.propertyName}. The minimum is {selected.currency} {selected.minimumPayout.toLocaleString("en-NG")}.</p></div></div><form onSubmit={withdraw} className="reach-form-grid"><div className="reach-field"><label htmlFor="wallet-property">Property</label><select id="wallet-property" value={selected.propertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>{wallets.map((wallet) => <option value={wallet.propertyId} key={wallet.propertyId}>{wallet.propertyName} · {wallet.currency} {wallet.availableBalance.toLocaleString("en-NG")}</option>)}</select></div><div className="reach-field"><label htmlFor="amount">Amount</label><input id="amount" type="number" min={selected.minimumPayout || 1} max={selected.availableBalance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" required /></div><div className="reach-form-actions"><button className="reach-button primary" disabled={busy || !selected.availableBalance}>{busy ? "Submitting…" : "Request payout"}</button></div></form>{message && <p className="reach-form-message">{message}</p>}</div>}
  </>;
}

"use client";

import { useEffect, useState } from "react";

type Property = { id: string; name: string; eligible: boolean; program: { enabled: boolean; activationPaymentStatus: string; activationFeeAmount: number; activationFeeCurrency: string } | null };

export function ReachActivationCard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/portal/reach-activation", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setProperties(data.properties || []);
    setPropertyId((current) => current || data.properties?.[0]?.id || "");
  }
  useEffect(() => { void load(); }, []);

  const selected = properties.find((property) => property.id === propertyId);
  async function activate() {
    if (!selected) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/portal/reach-activation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to start activation");
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
      else { setMessage("Reach activated successfully."); await load(); setBusy(false); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start activation"); setBusy(false); }
  }

  return <section id="reach-activation-card" className="portal-card" style={{ marginTop: 32, borderColor: "rgba(167,139,250,.35)", background: "linear-gradient(135deg, rgba(167,139,250,.08), transparent 60%)" }}>
    <div className="sub-section-kicker">Referral revenue network</div>
    <h2 className="sub-section-title" style={{ marginTop: 4 }}>LodgeCore Reach</h2>
    <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, maxWidth: 700, marginTop: 6 }}>Activate partner referrals for an eligible property. Reach charges a one-time activation fee and a platform fee only on qualifying referral revenue.</p>
    {properties.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 16 }}>Add an active property with Booking Engine, Standalone API, or PMS Website access to activate Reach.</p> : <div style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>Property<select className="input" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="" disabled>Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}{!property.eligible ? " — digital commerce add-on required" : ""}</option>)}</select></label>
      <button className="btn btn-primary btn-sm" onClick={() => void activate()} disabled={busy || !selected?.eligible || Boolean(selected?.program?.enabled)}>{busy ? "Opening Flutterwave…" : selected?.program?.enabled ? "Reach active" : selected?.program?.activationPaymentStatus === "PAID" ? "Activate Reach →" : `Activate for ${selected?.program?.activationFeeCurrency || "NGN"} ${(selected?.program?.activationFeeAmount || 50000).toLocaleString()}`}</button>
      {message && <span role="status" style={{ fontSize: 12, color: "var(--text-muted)" }}>{message}</span>}
    </div>}
  </section>;
}

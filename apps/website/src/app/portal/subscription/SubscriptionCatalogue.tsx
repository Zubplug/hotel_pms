"use client";

import { useState } from "react";

type Price = { id: string; amount: number; currency: string; interval: string };
type Product = { id: string; code: string; name: string; type: string; prices: Price[] };
type Plan = { id: string; code: string; name: string; description: string | null; metadata: unknown; items: { id: string; required: boolean; includedQty: number | null; product: Product }[] };

const money = (amount: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);

export default function SubscriptionCatalogue({ plans, addOns, properties }: { plans: Plan[]; addOns: Product[]; properties: { id: string; name: string }[] }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(key: string, priceIds: string[], planId?: string) {
    if (!priceIds.length) return setError("This option does not have a published price for the selected billing interval yet.");
    setBusy(key); setError(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priceIds, planId, propertyIds: propertyId ? [propertyId] : [], successUrl: `${window.location.origin}/portal/subscription?success=true`, cancelUrl: `${window.location.origin}/portal/subscription?cancelled=true` }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== "string") throw new Error(payload.error || "Unable to open payment checkout");
      window.location.assign(payload.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open payment checkout"); setBusy(null); }
  }

  function pricesFor(product: Product) { return product.prices.filter((price) => price.interval === interval); }
  function planPrices(plan: Plan) { return plan.items.map((item) => pricesFor(item.product)[0]).filter(Boolean); }

  return <div>
    <div className="portal-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
      <div><div className="portal-card-title" style={{ marginBottom: 4 }}>Choose billing scope</div><p style={{ fontSize: 13, color: "var(--text-muted)" }}>New access will be assigned to the selected property.</p></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="btn btn-outline btn-sm" aria-label="Property scope"><option value="">Organisation-wide</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
        <div style={{ display: "flex", gap: 4, padding: 4, border: "1px solid var(--border)", borderRadius: 8 }}><button className={`btn btn-sm ${interval === "month" ? "btn-primary" : "btn-outline"}`} onClick={() => setInterval("month")}>Monthly</button><button className={`btn btn-sm ${interval === "year" ? "btn-primary" : "btn-outline"}`} onClick={() => setInterval("year")}>Annual</button></div>
      </div>
    </div>
    {error && <div className="portal-card" role="alert" style={{ marginBottom: 16, color: "var(--danger, #b42318)" }}>{error}</div>}
    <div className="portal-section-heading"><div><div className="portal-page-kicker">Self-service catalogue</div><h2 className="portal-card-title">Available plans</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Select a plan and pay the resulting invoice through Flutterwave. Auto-renewal is not enabled by this payment.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 12 }}>
      {plans.map((plan) => { const prices = planPrices(plan); const complete = prices.length === plan.items.filter((item) => item.required).length; const total = prices.reduce((sum, price) => sum + price.amount, 0); return <div className="portal-card" key={plan.id} style={{ display: "flex", flexDirection: "column" }}><div className="portal-card-title">{plan.name}<span className="portal-badge badge-pending">{plan.code}</span></div><p style={{ minHeight: 42, marginTop: 8, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>{plan.description || "A LodgeCore subscription package for your hospitality operation."}</p><div style={{ margin: "18px 0", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{complete ? money(total, prices[0]?.currency.toUpperCase()) : "Price pending"}<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}> / {interval}</span></div><div style={{ flex: 1, borderTop: "1px solid var(--border)", paddingTop: 12 }}>{plan.items.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 12, color: "var(--text-muted)" }}><span>✓ {item.product.name}</span>{item.includedQty !== null && <span>{item.includedQty} included</span>}</div>)}</div><button className="btn btn-primary btn-sm" style={{ marginTop: 16 }} disabled={busy !== null || !complete} onClick={() => checkout(`plan-${plan.id}`, prices.map((price) => price.id), plan.id)}>{busy === `plan-${plan.id}` ? "Opening checkout…" : complete ? "Subscribe with invoice →" : "Price not available"}</button></div>; })}
    </div>
    <div className="portal-section-heading" style={{ marginTop: 30 }}><div><div className="portal-page-kicker">Optional expansion</div><h2 className="portal-card-title">Available add-ons</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Add-ons are billed separately and scoped to the selected property.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 12 }}>{addOns.map((product) => { const price = pricesFor(product)[0]; const key = `addon-${product.id}`; return <div className="portal-card" key={product.id}><div className="portal-card-title">{product.name}</div><p style={{ margin: "10px 0 16px", fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: 11 }}>{product.code}</p><div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{price ? <>{money(price.amount, price.currency.toUpperCase())}<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}> / {interval}</span></> : "Price pending"}</div><button className="btn btn-outline btn-sm" disabled={busy !== null || !price} onClick={() => price && checkout(key, [price.id])}>{busy === key ? "Opening checkout…" : price ? "Add with invoice →" : "Price not available"}</button></div>; })}{!addOns.length && <div className="portal-card" style={{ color: "var(--text-muted)", fontSize: 13 }}>No add-ons are currently available.</div>}</div>
  </div>;
}

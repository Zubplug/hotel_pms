"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type Price = { id: string; amount: number; currency: string; interval: string };
type Product = { id: string; code: string; name: string; type: string; prices: Price[]; modules?: { id: string; code: string; name: string; description: string | null }[] };
type PlanItem = { id: string; required: boolean; includedQty: number | null; product: Product };
type Plan = { id: string; code: string; name: string; description: string | null; metadata: unknown; items: PlanItem[] };

const money = (amount: number, currency = "NGN") => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
const label = (value: string) => value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());

export default function SubscriptionCatalogue({ plans, addOns, properties }: { plans: Plan[]; addOns: Product[]; properties: { id: string; name: string }[] }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{ kind: "plan" | "addon"; value: Plan | Product } | null>(null);

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
  function planLimits(plan: Plan) {
    if (!plan.metadata || typeof plan.metadata !== "object" || Array.isArray(plan.metadata)) return [];
    return Object.entries(plan.metadata as Record<string, unknown>).filter(([, value]) => value !== null && value !== undefined).map(([key, value]) => ({ label: label(key), value: String(value) === "null" ? "Unlimited" : String(value) }));
  }

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
      {plans.map((plan) => { const prices = planPrices(plan); const complete = prices.length === plan.items.filter((item) => item.required).length; const total = prices.reduce((sum, price) => sum + price.amount, 0); const limits = planLimits(plan); return <div className="portal-card" key={plan.id} style={{ display: "flex", flexDirection: "column" }}><div className="portal-card-title" style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>{plan.name}<span className="portal-badge badge-pending">{plan.code}</span></div><p style={{ minHeight: 42, marginTop: 8, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>{plan.description || "A LodgeCore subscription package for your hospitality operation."}</p><div style={{ margin: "18px 0", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{complete ? money(total, prices[0]?.currency.toUpperCase()) : "Price pending"}<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}> / {interval}</span></div><div style={{ flex: 1, borderTop: "1px solid var(--border)", paddingTop: 12 }}>{plan.items.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", fontSize: 12, color: "var(--text-muted)" }}><span>✓ {item.product.name}</span>{item.includedQty !== null && <span>{item.includedQty} included</span>}</div>)}{limits.length > 0 && <div style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 11 }}>{limits.slice(0, 2).map((limit) => <div key={limit.label}>{limit.label}: <strong style={{ color: "var(--text-secondary)" }}>{limit.value}</strong></div>)}</div>}</div><div style={{ display: "flex", gap: 8, marginTop: 16 }}><button className="btn btn-outline btn-sm" onClick={() => setDetails({ kind: "plan", value: plan })}>View details</button><button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={busy !== null || !complete} onClick={() => checkout(`plan-${plan.id}`, prices.map((price) => price.id), plan.id)}>{busy === `plan-${plan.id}` ? "Opening checkout…" : complete ? "Subscribe with invoice →" : "Price not available"}</button></div></div>; })}
    </div>
    <div className="portal-section-heading" style={{ marginTop: 30 }}><div><div className="portal-page-kicker">Optional expansion</div><h2 className="portal-card-title">Available add-ons</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Add-ons are billed separately and scoped to the selected property.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 12 }}>{addOns.map((product) => { const price = pricesFor(product)[0]; const key = `addon-${product.id}`; return <div className="portal-card" key={product.id} style={{ display: "flex", flexDirection: "column" }}><div className="portal-card-title">{product.name}</div><p style={{ margin: "10px 0 16px", fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: 11 }}>{product.code}</p>{product.modules?.length ? <p style={{ minHeight: 36, color: "var(--text-muted)", fontSize: 12 }}>{product.modules.length} capability{product.modules.length === 1 ? "" : "ies"} included</p> : <p style={{ minHeight: 36, color: "var(--text-muted)", fontSize: 12 }}>Property-scoped capability extension</p>}<div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>{price ? <>{money(price.amount, price.currency.toUpperCase())}<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}> / {interval}</span></> : "Price pending"}</div><div style={{ display: "flex", gap: 8, marginTop: "auto" }}><button className="btn btn-outline btn-sm" onClick={() => setDetails({ kind: "addon", value: product })}>View details</button><button className="btn btn-outline btn-sm" style={{ flex: 1 }} disabled={busy !== null || !price} onClick={() => price && checkout(key, [price.id])}>{busy === key ? "Opening checkout…" : price ? "Add with invoice →" : "Price not available"}</button></div></div>; })}{!addOns.length && <div className="portal-card" style={{ color: "var(--text-muted)", fontSize: 13 }}>No add-ons are currently available.</div>}</div>
    {details && <CatalogueDetails details={details} interval={interval} onClose={() => setDetails(null)} />}
  </div>;
}

function CatalogueDetails({ details, interval, onClose }: { details: { kind: "plan" | "addon"; value: Plan | Product }; interval: "month" | "year"; onClose: () => void }) {
  const value = details.value;
  const plan = details.kind === "plan" ? value as Plan : null;
  const product = details.kind === "addon" ? value as Product : null;
  const prices = product ? product.prices.filter((price) => price.interval === interval) : [];
  const limits = plan && plan.metadata && typeof plan.metadata === "object" && !Array.isArray(plan.metadata) ? Object.entries(plan.metadata as Record<string, unknown>) : [];
  return <div role="dialog" aria-modal="true" aria-labelledby="catalogue-details-title" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", padding: 20, background: "rgba(2, 6, 23, .78)" }}><div className="portal-card" onClick={(event) => event.stopPropagation()} style={{ width: "min(620px, 100%)", maxHeight: "min(720px, 90vh)", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,.45)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}><div><div className="portal-page-kicker">{details.kind === "plan" ? "Plan detail" : "Add-on detail"}</div><h2 id="catalogue-details-title" className="portal-card-title" style={{ marginTop: 5 }}>{value.name}</h2><div style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 6 }}>{value.code}</div></div><button className="btn btn-outline btn-sm" onClick={onClose} aria-label="Close details">Close</button></div>{plan?.description && <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.7, marginTop: 18 }}>{plan.description}</p>}{plan && <><DetailSection title="Included capabilities"><div style={{ display: "grid", gap: 8 }}>{plan.items.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13 }}><span>{item.product.name} {!item.required && <span className="portal-badge badge-pending">Optional</span>}</span><span>{item.includedQty === null ? "Unlimited" : `${item.includedQty} included`}</span></div>)}</div></DetailSection>{limits.length > 0 && <DetailSection title="Plan limits"><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>{limits.map(([key, entry]) => <div key={key} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}><div className="portal-stat-label">{label(key)}</div><div style={{ color: "var(--text-primary)", marginTop: 4, fontSize: 13 }}>{entry === null ? "Unlimited" : String(entry)}</div></div>)}</div></DetailSection>}</>}{product && <><DetailSection title="Capability coverage">{product.modules?.length ? <div style={{ display: "grid", gap: 10 }}>{product.modules.map((module) => <div key={module.id} style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}><div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{module.name}</div><div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 3 }}>{module.code}</div>{module.description && <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>{module.description}</div>}</div>)}</div> : <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No module-level capability descriptions have been published for this catalogue item.</p>}</DetailSection><DetailSection title="Selected billing interval"><div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{prices.length ? prices.map((price) => <div key={price.id}>{money(price.amount, price.currency.toUpperCase())} / {price.interval}</div>) : "Price pending for the selected interval."}</div></DetailSection></>}</div></div>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) { return <section style={{ marginTop: 22 }}><div className="portal-page-kicker" style={{ marginBottom: 9 }}>{title}</div>{children}</section>; }

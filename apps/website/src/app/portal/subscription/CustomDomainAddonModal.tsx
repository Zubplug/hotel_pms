"use client";

import { useState } from "react";

type Property = { id: string; name: string };
type Price = { id: string; amount: number; currency: string; interval: string };
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount / 100);

export default function CustomDomainAddonModal({ properties, domainPrice, onError, onClose }: { properties: Property[]; domainPrice?: Price; onError: (message: string) => void; onClose: () => void }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<{ available: boolean; message: string; suggestions?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true); onError("");
    try { const response = await fetch(`/api/domains/availability?domain=${encodeURIComponent(domain)}`); const data = await response.json(); setResult(data); if (!response.ok) onError(data.error || data.message || "Unable to check domain"); }
    catch { onError("Unable to check domain right now"); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); onError("");
    try {
      const requestResponse = await fetch("/api/billing/custom-domain-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId, domain }) });
      const requestData = await requestResponse.json();
      if (!requestResponse.ok) throw new Error(requestData.error || "Unable to create domain request");
      const priceIds = [requestData.domainPriceId, requestData.bookingEnginePriceId].filter(Boolean);
      const checkoutResponse = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ priceIds, propertyIds: [propertyId], customDomainRequestId: requestData.domainRequest.id, successUrl: `${window.location.origin}/portal/subscription?success=true`, cancelUrl: `${window.location.origin}/portal/subscription?cancelled=true` }) });
      const checkoutData = await checkoutResponse.json();
      if (!checkoutResponse.ok) throw new Error(checkoutData.error || "Unable to open payment checkout");
      window.location.assign(checkoutData.url);
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to start checkout"); setBusy(false); }
  }
  return <div className="sub-modal-backdrop" role="dialog" aria-modal="true"><div className="portal-card sub-website-modal"><div className="sub-website-modal-head"><div><div className="sub-section-kicker">Branded guest experience</div><h2 className="sub-section-title">Add a custom domain</h2><p className="sub-modal-copy">Check your preferred domain before payment. Booking Engine is included automatically when your property does not already have it.</p></div><button className="sub-modal-close" onClick={onClose} aria-label="Close">×</button></div><div className="sub-website-grid"><label>Property<select value={propertyId} onChange={event => setPropertyId(event.target.value)}>{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label className="sub-website-wide">Domain<input value={domain} onChange={event => { setDomain(event.target.value); setResult(null); }} placeholder="book.yourhotel.com" /></label></div><div className="sub-website-domain"><div className="sub-website-domain-row"><button className="btn btn-outline btn-sm" onClick={() => void check()} disabled={busy || !domain.trim()}>Check domain</button></div>{result && <div className={result.available ? "sub-domain-good" : "sub-domain-warn"}>{result.message}{result.suggestions?.length ? <div className="sub-domain-suggestions">{result.suggestions.map(suggestion => <button key={suggestion} onClick={() => { setDomain(suggestion); setResult(null); }}>{suggestion}</button>)}</div> : null}</div>}</div><div className="sub-modal-actions"><span>Domain: <strong>{domainPrice ? `${money(domainPrice.amount, domainPrice.currency)}/mo` : "Price unavailable"}</strong><br />Configuration starts after successful payment.</span><div><button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy || !propertyId || !domain.trim() || !result?.available}>{busy ? "Preparing checkout…" : "Create request and pay →"}</button></div></div></div></div>;
}

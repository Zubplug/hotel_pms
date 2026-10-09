"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Property = { id: string; name: string };
type Price = { id: string; amount: number; currency: string; interval: string };
type DevelopmentMode = "STANDALONE_API" | "PMS_CONNECTED";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount / 100);

export default function CustomWebsiteAddonModal({
  properties,
  websitePrices,
  domainPrice,
  onError,
  initiallyOpen = false,
  onClose,
}: {
  properties: Property[];
  websitePrices: { standalone?: Price; pms?: Price };
  domainPrice?: Price;
  onError: (message: string) => void;
  initiallyOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [developmentMode, setDevelopmentMode] = useState<DevelopmentMode>("PMS_CONNECTED");
  const [domain, setDomain] = useState("");
  const [domainResult, setDomainResult] = useState<{ available: boolean; message: string; suggestions?: string[] } | null>(null);
  const [brief, setBrief] = useState({ projectName: "", tagline: "", audience: "", pages: "Home, About, Rooms, Contact", features: "", colors: "", references: "", contentReady: "I need help preparing content", contactEmail: "", notes: "" });
  const selectedWebsitePrice = developmentMode === "STANDALONE_API" ? websitePrices.standalone : websitePrices.pms;

  useEffect(() => {
    setMounted(true);
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const update = (key: keyof typeof brief, value: string) => setBrief(current => ({ ...current, [key]: value }));
  const close = () => { if (!busy) { setOpen(false); setDomainResult(null); onClose?.(); } };

  async function checkDomain() {
    setBusy(true); onError("");
    try {
      const response = await fetch(`/api/domains/availability?domain=${encodeURIComponent(domain)}`);
      const data = await response.json();
      setDomainResult(data);
      if (!response.ok) onError(data.error || data.message || "Unable to check domain");
    } catch { onError("Unable to check domain right now"); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!selectedWebsitePrice) return;
    setBusy(true); onError("");
    try {
      const requestResponse = await fetch("/api/billing/custom-website-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId, developmentMode, domain: domain.trim() || undefined, brief }) });
      const requestData = await requestResponse.json();
      if (!requestResponse.ok) throw new Error(requestData.error || "Unable to create website brief");
      const priceIds = [requestData.websitePriceId, requestData.domainPriceId, requestData.bookingEnginePriceId].filter(Boolean);
      const checkoutResponse = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ priceIds, propertyIds: [propertyId], customWebsiteRequestId: requestData.websiteRequest.id, customDomainRequestId: requestData.domainRequest?.id, successUrl: `${window.location.origin}/portal/subscription?success=true`, cancelUrl: `${window.location.origin}/portal/subscription?cancelled=true` }) });
      const checkoutData = await checkoutResponse.json();
      if (!checkoutResponse.ok) throw new Error(checkoutData.error || "Unable to open payment checkout");
      window.location.assign(checkoutData.url);
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to start checkout"); setBusy(false); }
  }

  const modal = open ? <div className="sub-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="custom-website-title" onClick={close}>
    <div className="sub-modal sub-website-modal" onClick={event => event.stopPropagation()}>
      <div className="sub-website-modal-head"><div><div className="sub-section-kicker">White-glove website service</div><h2 id="custom-website-title" className="sub-section-title">Create your property website</h2><p className="sub-modal-copy">Choose a standalone API website or a website connected directly to the LodgeCore PMS.</p></div><button className="sub-modal-close" onClick={close} aria-label="Close">×</button></div>
      <div className="sub-website-grid">
        <label>Development type<select value={developmentMode} onChange={event => setDevelopmentMode(event.target.value as DevelopmentMode)}><option value="PMS_CONNECTED">PMS-connected website — ₦2,500,000</option><option value="STANDALONE_API">Standalone website using LodgeCore API — ₦1,200,000</option></select></label>
        <label>Project name<input value={brief.projectName} onChange={event => update("projectName", event.target.value)} placeholder="The Palm Hotel website" /></label>
        <label>Property<select value={propertyId} onChange={event => { setPropertyId(event.target.value); setDomainResult(null); }}>{properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label className="sub-website-wide">Tagline<input value={brief.tagline} onChange={event => update("tagline", event.target.value)} placeholder="A short message for your guests" /></label>
        <label>Ideal guests<textarea value={brief.audience} onChange={event => update("audience", event.target.value)} placeholder="Business travellers, families..." /></label>
        <label>Pages required<textarea value={brief.pages} onChange={event => update("pages", event.target.value)} placeholder="Home, Rooms, Gallery, Contact" /></label>
        <label>Features and integrations<textarea value={brief.features} onChange={event => update("features", event.target.value)} placeholder="Booking button, WhatsApp, gallery..." /></label>
        <label>Colours and visual direction<textarea value={brief.colors} onChange={event => update("colors", event.target.value)} placeholder="Colours, mood, logo guidance..." /></label>
        <label className="sub-website-wide">Reference websites<textarea value={brief.references} onChange={event => update("references", event.target.value)} placeholder="Paste websites whose style you like" /></label>
        <label>Content readiness<select value={brief.contentReady} onChange={event => update("contentReady", event.target.value)}><option>I have all content ready</option><option>I have some content ready</option><option>I need help preparing content</option></select></label>
        <label>Contact email<input type="email" value={brief.contactEmail} onChange={event => update("contactEmail", event.target.value)} placeholder="owner@example.com" /></label>
        <label className="sub-website-wide">Additional notes<textarea value={brief.notes} onChange={event => update("notes", event.target.value)} placeholder="Anything else the project team should know?" /></label>
      </div>
      <section className="sub-website-domain"><strong>Optional custom domain</strong><p>Custom domains require Booking Engine. If your property does not have it, it will be included in this checkout.</p><div className="sub-website-domain-row"><input value={domain} onChange={event => { setDomain(event.target.value); setDomainResult(null); }} placeholder="book.yourhotel.com" /><button className="btn btn-outline btn-sm" onClick={() => void checkDomain()} disabled={busy || !domain.trim()}>Check domain</button></div>{domainResult && <div className={domainResult.available ? "sub-domain-good" : "sub-domain-warn"}>{domainResult.message}</div>}</section>
      <div className="sub-modal-actions"><span>Website: <strong>{selectedWebsitePrice ? money(selectedWebsitePrice.amount, selectedWebsitePrice.currency) : "Price unavailable"}</strong>{domain && domainResult?.available && domainPrice && <> · Domain: <strong>{money(domainPrice.amount, domainPrice.currency)}/{domainPrice.interval === "year" ? "year" : "mo"}</strong></>}<br />HQ development starts after successful payment.</span><div><button className="btn btn-outline btn-sm" onClick={close} disabled={busy}>Cancel</button><button className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={busy || !selectedWebsitePrice || !brief.projectName.trim() || !brief.pages.trim() || !propertyId || Boolean(domain && !domainResult?.available)}>{busy ? "Preparing checkout…" : "Create brief and pay →"}</button></div></div>
    </div>
  </div> : null;

  return <>{!initiallyOpen && <button className="btn btn-outline btn-sm sub-addon-cta" onClick={() => setOpen(true)} disabled={!selectedWebsitePrice || !properties.length}>Design my website →</button>}{open && mounted && createPortal(modal, document.body)}</>;
}

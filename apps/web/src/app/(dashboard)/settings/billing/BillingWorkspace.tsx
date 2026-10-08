'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CreditCard, Globe2, Loader2, X } from 'lucide-react';
import CustomWebsiteRequestModal from './CustomWebsiteRequestModal';

type Product = { id: string; code: string; name: string; type: string; description: string | null; prices: Array<{ id: string; amount: number; currency: string; interval: string }> };
type Property = { id: string; name: string };
type DomainRequest = { id: string; domain: string; propertyId: string; status: string; amount: number; currency: string; billingPriceId: string | null };

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount / 100);
}

export default function BillingWorkspace({ organizationId, products, properties, requests: initialRequests }: { organizationId: string; products: Product[]; properties: Property[]; requests: DomainRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [availability, setAvailability] = useState<{ available: boolean; message: string; suggestions?: string[]; bookingEngineRequired?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const domainProduct = products.find((product) => product.code === 'ADDON_CUSTOM_DOMAIN');
  const addOns = products.filter((product) => product.type === 'ADDON');
  const price = domainProduct?.prices[0];
  const activeRequest = useMemo(() => requests.find((request) => request.propertyId === propertyId && request.domain === domain.trim().toLowerCase().replace(/\.$/, '')), [requests, propertyId, domain]);

  function openDomainDialog() { setError(''); setAvailability(null); setDomain(''); setDialogOpen(true); }
  async function checkAvailability() {
    setBusy(true); setError(''); setAvailability(null);
    try {
      const response = await fetch(`/api/v1/domains/availability?domain=${encodeURIComponent(domain)}&propertyId=${encodeURIComponent(propertyId)}`);
      const data = await response.json();
      setAvailability(data);
      if (!response.ok) setError(data.error || data.message || 'Could not check this domain.');
    } catch { setError('Could not check this domain right now.'); }
    finally { setBusy(false); }
  }
  async function requestConfiguration(includeBookingEngine = availability?.bookingEngineRequired === true) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/v1/billing/custom-domain-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ domain, propertyId, includeBookingEngine }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to submit the request.');
      setRequests((current) => [data.request, ...current.filter((request) => request.id !== data.request.id)]);
      if (data.bookingEnginePriceId) await startCheckout(data.request, data.bookingEnginePriceId);
      else { setDialogOpen(false); setAvailability(null); }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to submit the request.'); }
    finally { setBusy(false); }
  }
  async function startCheckout(request: DomainRequest, additionalPriceId?: string) {
    if (!request.billingPriceId) throw new Error('Custom-domain pricing is not available.');
    const response = await fetch('/api/v1/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId, customDomainRequestId: request.id, priceIds: [request.billingPriceId, ...(additionalPriceId ? [additionalPriceId] : [])], successUrl: `${window.location.origin}/settings/billing?success=true` }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to start payment.');
    window.location.assign(data.url);
  }
  async function pay(request: DomainRequest) {
    setBusy(true); setError('');
    try {
      await startCheckout(request);
    } catch (paymentError) { setError(paymentError instanceof Error ? paymentError.message : 'Unable to start payment.'); setBusy(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-8 p-6 md:p-8"><header><p className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-500">Account billing</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Plans and add-ons</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Extend your property with optional services. A Booking Engine is required before a custom booking domain can be configured.</p></header>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{addOns.map((product) => { const productPrice = product.prices[0]; const isDomain = product.code === 'ADDON_CUSTOM_DOMAIN'; const isWebsite = product.code === 'ADDON_CUSTOM_WEBSITE_DESIGN'; return <article key={product.id} className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{isDomain ? <Globe2 className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}</span>{productPrice && <span className="text-sm font-semibold">{money(productPrice.amount, productPrice.currency)}<span className="font-normal text-muted-foreground">/{productPrice.interval === 'month' ? 'mo' : productPrice.interval}</span></span>}</div><h2 className="mt-5 text-lg font-semibold">{product.name}</h2><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{product.description || 'Optional LodgeCore capability for your property.'}</p>{isDomain ? <button onClick={openDomainDialog} className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Add custom domain</button> : isWebsite ? <CustomWebsiteRequestModal organizationId={organizationId} properties={properties} websitePrice={productPrice} domainPrice={domainProduct?.prices[0]} /> : <button disabled className="mt-6 rounded-xl border px-4 py-2.5 text-sm font-semibold text-muted-foreground">Contact LodgeCore</button>}</article>; })}</section>
    {requests.length > 0 && <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">Custom domain requests</h2><div className="mt-4 divide-y">{requests.map((request) => <div key={request.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm font-semibold">{request.domain}</p><p className="mt-1 text-xs text-muted-foreground">{properties.find((property) => property.id === request.propertyId)?.name || 'Property'} · {request.status}</p></div>{request.status === 'REQUESTED' && <button disabled={busy || !request.billingPriceId} onClick={() => void pay(request)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />} Pay for configuration</button>}{['REQUESTED', 'PAYMENT_PENDING', 'PAID', 'ACTIVE'].includes(request.status) && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{request.status === 'REQUESTED' || request.status === 'PAYMENT_PENDING' ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}{request.status === 'REQUESTED' ? 'Ready for payment' : request.status === 'PAYMENT_PENDING' ? 'Payment processing' : request.status === 'PAID' ? 'Paid · HQ configuration pending' : 'Active'}</span>}</div>)}</div></section>}
    {dialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Check your domain</h2><p className="mt-1 text-sm text-muted-foreground">We will confirm availability before sending a configuration request.</p></div><button onClick={() => setDialogOpen(false)} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-slate-100"><X className="h-5 w-5" /></button></div><label className="mt-6 block text-sm font-medium">Domain name<input value={domain} onChange={(event) => { setDomain(event.target.value); setAvailability(null); }} placeholder="book.yourhotel.com" className="mt-2 h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-indigo-500" /></label><label className="mt-4 block text-sm font-medium">Property<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-indigo-500">{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>{availability && <div className={`mt-4 rounded-lg border p-3 text-sm ${availability.available ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><p>{availability.message}</p>{!availability.available && Boolean(availability.suggestions?.length) && <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide">Available suggestions</p><div className="mt-2 flex flex-wrap gap-2">{availability.suggestions?.map((suggestion) => <button key={suggestion} onClick={() => { setDomain(suggestion); setAvailability(null); }} className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">{suggestion}</button>)}</div><p className="mt-2 text-xs">Select one to search it, then request configuration if it works for you.</p></div>}</div>}{activeRequest && <p className="mt-3 text-xs text-amber-700">A request already exists for this property and domain.</p>}<div className="mt-6 flex justify-end gap-2"><button onClick={() => setDialogOpen(false)} className="rounded-lg px-4 py-2 text-sm text-muted-foreground">Cancel</button>{!availability?.available ? <button disabled={busy || !domain.trim() || !propertyId} onClick={() => void checkAvailability()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Check availability</button> : <button disabled={busy || Boolean(activeRequest)} onClick={() => void requestConfiguration()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Request configuration</button>}</div>{price && <p className="mt-4 text-center text-xs text-muted-foreground">Current price after approval: {money(price.amount, price.currency)}/{price.interval === 'month' ? 'month' : price.interval}.</p>}</div></div>}
  </main>;
}

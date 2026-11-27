'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Code2, Copy, Check, Loader2, ExternalLink, Zap } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CommerceIntegrationsClient() {
  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher);
  const stores: any[] = storesData?.data ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const activeStoreId = storeId ?? stores[0]?.id;
  const store = stores.find((s: any) => s.id === activeStoreId);
  const slug = store?.slug ?? 'your-store-slug';

  // Determine base URL — public API lives on apps/web
  const apiBase = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://pms.zubplug.com.ng';

  const storefrontUrl = `${apiBase}/api/commerce/storefront/${slug}`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const embedScript = `<script src="${apiBase}/commerce-widget.js" data-store="${slug}" async></script>`;

  const iframeEmbed = `<iframe
  src="${apiBase}/order/${slug}"
  width="100%"
  height="700"
  frameborder="0"
  allow="payment"
  title="Order from ${store?.name ?? 'our restaurant'}"
></iframe>`;

  const curlExample = `# Get store menu
curl "${storefrontUrl}/menu"

# Place an order
curl -X POST "${storefrontUrl}/orders" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerName": "Femi Adeyemi",
    "customerPhone": "+2348012345678",
    "orderType": "PICKUP",
    "items": [
      { "productId": "<product-id>", "quantity": 2 }
    ],
    "idempotencyKey": "<unique-key>"
  }'`;

  const API_ENDPOINTS = [
    { method: 'GET',  path: `/api/commerce/storefront/${slug}`,             desc: 'Store info, hours, branding' },
    { method: 'GET',  path: `/api/commerce/storefront/${slug}/menu`,         desc: 'Menu, categories and products' },
    { method: 'POST', path: `/api/commerce/storefront/${slug}/orders`,        desc: 'Place a new order (idempotent)' },
    { method: 'GET',  path: `/api/commerce/storefront/${slug}/orders/:ref/track`, desc: 'Track order by reference' },
    { method: 'POST', path: `/api/commerce/storefront/${slug}/payment/initiate`, desc: 'Initiate Paystack/Flutterwave payment' },
    { method: 'POST', path: `/api/commerce/storefront/${slug}/payment/verify`, desc: 'Webhook: payment confirmed' },
    { method: 'POST', path: `/api/commerce/storefront/${slug}/promotions/validate`, desc: 'Validate promo code' },
  ];

  const METHOD_COLOR: Record<string, string> = { GET: '#10b981', POST: '#3b82f6', PATCH: '#f59e0b', DELETE: '#ef4444' };

  if (!storesData) return <div className="int-loading"><Loader2 className="animate-spin" size={28} /></div>;

  return (
    <div className="int-page">
      <div className="int-header">
        <div>
          <h1 className="int-title">Integrations</h1>
          <p className="int-sub">Embed Food Commerce on any website, or integrate via REST API</p>
        </div>
        {stores.length > 1 && (
          <select className="commerce-select" value={activeStoreId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Quick links */}
      <div className="int-quick-links">
        <a href={`${storefrontUrl}`} target="_blank" rel="noopener noreferrer" className="int-quick-link">
          <ExternalLink size={14} /> Test API endpoint
        </a>
        <a href={`/api/commerce/storefront/${slug}/menu`} target="_blank" rel="noopener noreferrer" className="int-quick-link">
          <ExternalLink size={14} /> View live menu JSON
        </a>
      </div>

      {/* Store slug */}
      <section className="int-card">
        <div className="int-card__icon" style={{ background: 'hsl(262 83% 15%)' }}><Zap size={18} style={{ color: 'hsl(262 83% 70%)' }} /></div>
        <div>
          <h2 className="int-card__title">Your Store Slug</h2>
          <p className="int-card__sub">Use this in every API call. Change it in Store Setup.</p>
          <div className="int-code-row">
            <code className="int-code">{slug}</code>
            <button className="int-copy-btn" onClick={() => copy(slug, 'slug')}>
              {copied === 'slug' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </section>

      {/* Script embed */}
      <section className="int-card">
        <div className="int-card__icon" style={{ background: 'hsl(199 89% 15%)' }}><Code2 size={18} style={{ color: 'hsl(199 89% 60%)' }} /></div>
        <div style={{ flex: 1 }}>
          <h2 className="int-card__title">Script Embed (Recommended)</h2>
          <p className="int-card__sub">Paste this tag inside the <code>&lt;body&gt;</code> of your hotel website. A floating order button appears automatically.</p>
          <div className="int-code-block">
            <pre className="int-pre">{embedScript}</pre>
            <button className="int-copy-btn int-copy-btn--abs" onClick={() => copy(embedScript, 'script')}>
              {copied === 'script' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </section>

      {/* iFrame embed */}
      <section className="int-card">
        <div className="int-card__icon" style={{ background: 'hsl(37 91% 15%)' }}><Code2 size={18} style={{ color: 'hsl(37 91% 60%)' }} /></div>
        <div style={{ flex: 1 }}>
          <h2 className="int-card__title">iFrame Embed</h2>
          <p className="int-card__sub">Drop a full ordering page into any existing website with an iFrame.</p>
          <div className="int-code-block">
            <pre className="int-pre">{iframeEmbed}</pre>
            <button className="int-copy-btn int-copy-btn--abs" onClick={() => copy(iframeEmbed, 'iframe')}>
              {copied === 'iframe' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </section>

      {/* REST API reference */}
      <section className="int-api-ref">
        <h2 className="int-section-title">REST API Reference</h2>
        <p className="int-section-sub">All endpoints are public — no authentication required for customer-facing calls. Base URL: <code className="int-inline-code">{apiBase}</code></p>
        <div className="int-endpoints">
          {API_ENDPOINTS.map((ep) => (
            <div key={ep.path} className="int-endpoint">
              <span className="int-method" style={{ background: `${METHOD_COLOR[ep.method]}20`, color: METHOD_COLOR[ep.method] }}>{ep.method}</span>
              <code className="int-endpoint-path">{ep.path}</code>
              <span className="int-endpoint-desc">{ep.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* cURL example */}
      <section className="int-card">
        <div style={{ flex: 1 }}>
          <h2 className="int-card__title">Quick Start Example</h2>
          <div className="int-code-block">
            <pre className="int-pre int-pre--dark">{curlExample}</pre>
            <button className="int-copy-btn int-copy-btn--abs int-copy-btn--light" onClick={() => copy(curlExample, 'curl')}>
              {copied === 'curl' ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      </section>

      <style>{`
        .int-page { display: flex; flex-direction: column; gap: 20px; max-width: 860px; }
        .int-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .int-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .int-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
        .int-loading { display: flex; align-items: center; justify-content: center; min-height: 300px; color: #9ca3af; }

        .int-quick-links { display: flex; gap: 10px; flex-wrap: wrap; }
        .int-quick-link { display: flex; align-items: center; gap: 6px; font-size: 12px; color: hsl(262 83% 58%); text-decoration: none; padding: 6px 12px; border: 1px solid hsl(262 83% 85%); border-radius: 999px; background: hsl(262 83% 97%); }
        .int-quick-link:hover { background: hsl(262 83% 93%); }

        .int-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; display: flex; gap: 16px; }
        .int-card__icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .int-card__title { font-size: 15px; font-weight: 600; color: hsl(222 47% 11%); margin: 0 0 4px; }
        .int-card__sub { font-size: 13px; color: #6b7280; margin: 0 0 12px; }
        .int-code-row { display: flex; align-items: center; gap: 8px; }
        .int-code { font-family: monospace; font-size: 14px; font-weight: 700; padding: 6px 12px; background: #f3f4f6; border-radius: 6px; color: hsl(222 47% 11%); }

        .int-code-block { position: relative; }
        .int-pre { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; font-size: 12px; font-family: monospace; overflow-x: auto; white-space: pre; color: hsl(222 47% 20%); margin: 0; }
        .int-pre--dark { background: hsl(222 47% 11%); color: hsl(210 40% 90%); border-color: hsl(222 47% 18%); }

        .int-copy-btn { background: #f3f4f6; border: none; border-radius: 6px; padding: 6px; cursor: pointer; color: #6b7280; display: flex; align-items: center; }
        .int-copy-btn--abs { position: absolute; top: 10px; right: 10px; }
        .int-copy-btn--light { background: hsl(222 47% 18%); color: hsl(210 40% 70%); }
        .int-copy-btn:hover { background: #e5e7eb; }

        .int-api-ref { display: flex; flex-direction: column; gap: 12px; }
        .int-section-title { font-size: 16px; font-weight: 600; color: hsl(222 47% 11%); margin: 0; }
        .int-section-sub { font-size: 13px; color: #6b7280; margin: 0; }
        .int-inline-code { font-family: monospace; font-size: 12px; background: #f3f4f6; padding: 1px 5px; border-radius: 4px; }
        .int-endpoints { background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
        .int-endpoint { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid #f3f4f6; flex-wrap: wrap; }
        .int-endpoint:last-child { border-bottom: none; }
        .int-method { font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 5px; flex-shrink: 0; }
        .int-endpoint-path { font-family: monospace; font-size: 12px; color: hsl(222 47% 20%); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .int-endpoint-desc { font-size: 12px; color: #9ca3af; white-space: nowrap; }

        .commerce-select { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer; }
      `}</style>
    </div>
  );
}

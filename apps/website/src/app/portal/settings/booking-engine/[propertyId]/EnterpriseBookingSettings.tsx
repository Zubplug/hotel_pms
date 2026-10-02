"use client";

import { useRef, useState, useTransition } from "react";
import { saveBookingContent, saveBookingPaymentAccount, saveBookingDomain, verifyBookingDomain, requestCustomDomain, requestCustomWebsite } from "./actions";

type Site = { siteName: string; customDomain?: string | null; domainStatus?: string | null; verificationToken?: string | null; content?: Record<string, any> | null };
type Account = { id: string; provider: string; mode: string; currency: string; publicKey: string | null; secretRef: string | null; webhookSecretRef: string | null } | null;
type DomainRequest = { id: string; domain: string; status: string; amount: number; currency: string } | null;
type WebsiteRequest = { id: string; status: string; amount: number; currency: string; brief: string | null } | null;

function FormCard({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (form: HTMLFormElement) => Promise<void> }) {
  const ref = useRef<HTMLFormElement>(null); const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  return <form ref={ref} className="portal-card" onSubmit={(e) => { e.preventDefault(); setMessage(""); start(async () => { try { await onSubmit(ref.current!); setMessage("Saved"); } catch (error: any) { setMessage(error.message ?? "Could not save"); } }); }}>
    <div className="portal-card-title">{title}</div>{children}<div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}><button disabled={pending} type="submit" className="portal-primary-button">{pending ? "Saving…" : "Save changes"}</button>{message && <span style={{ fontSize: 12, color: message === "Saved" ? "#15803d" : "#b42318" }}>{message}</span>}</div>
  </form>;
}

export function EnterpriseBookingSettings({ propertyId, site, account, customDomainRequest, customWebsiteRequest }: { propertyId: string; site: Site | null; account: Account; customDomainRequest: DomainRequest; customWebsiteRequest: WebsiteRequest }) {
  const content = site?.content ?? {};
  return <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
    <FormCard title="Custom website design service" onSubmit={(form) => requestCustomWebsite(propertyId, new FormData(form))}>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}><label>Describe the website you want<textarea name="brief" rows={5} defaultValue={customWebsiteRequest?.brief ?? ""} placeholder="Describe your brand, pages, imagery, style, and special requirements…" disabled={!!customWebsiteRequest && !["REJECTED", "CANCELLED"].includes(customWebsiteRequest.status)} /></label><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Status: <strong>{customWebsiteRequest?.status ?? "Not requested"}</strong>{customWebsiteRequest?.amount ? ` · ${customWebsiteRequest.currency.toUpperCase()} ${(customWebsiteRequest.amount / 100).toLocaleString()} one-time` : " · HQ will quote this service"}</p>{customWebsiteRequest?.status === "APPROVED" && <button type="button" className="portal-primary-button" onClick={async () => { const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customWebsiteRequestId: customWebsiteRequest.id, successUrl: window.location.href }) }); const data = await response.json(); if (!response.ok) return window.alert(data.error ?? "Unable to start payment"); window.location.href = data.url; }}>Pay design fee</button>}</div>
    </FormCard>
    <FormCard title="Custom domain service request" onSubmit={(form) => requestCustomDomain(propertyId, new FormData(form))}>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}><label>Requested domain<input name="domain" type="text" defaultValue={customDomainRequest?.domain ?? ""} placeholder="book.example.com" disabled={!!customDomainRequest && customDomainRequest.status !== "REJECTED"} /></label><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Status: <strong>{customDomainRequest?.status ?? "Not requested"}</strong>{customDomainRequest?.amount ? ` · ${customDomainRequest.currency.toUpperCase()} ${(customDomainRequest.amount / 100).toLocaleString()} / month` : ""}</p>{customDomainRequest?.status === "APPROVED" && <button type="button" className="portal-primary-button" onClick={async () => { const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customDomainRequestId: customDomainRequest.id, successUrl: window.location.href }) }); const data = await response.json(); if (!response.ok) return window.alert(data.error ?? "Unable to start payment"); window.location.href = data.url; }}>Pay custom-domain fee</button>}</div>
    </FormCard>
    <FormCard title="Content, contact and guest policies" onSubmit={(form) => saveBookingContent(propertyId, new FormData(form))}>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label>Hero title<input name="heroTitle" defaultValue={content.heroTitle ?? content.tagline ?? "Welcome"} /></label>
        <label>Hero subtitle<textarea name="heroSubtitle" defaultValue={content.heroSubtitle ?? "Book direct for the best available rate."} rows={3} /></label>
        <label>Amenities <span style={{ fontWeight: 400 }}>(one per line)</span><textarea name="amenities" defaultValue={Array.isArray(content.amenities) ? content.amenities.join("\n") : ""} rows={4} /></label>
        <label>Public cancellation policy<textarea name="cancellationText" defaultValue={content.cancellationText ?? "Cancellation policy applies according to the selected rate plan."} rows={3} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><label>Contact phone<input name="contactPhone" defaultValue={content.contactPhone ?? ""} /></label><label>Contact email<input name="contactEmail" type="email" defaultValue={content.contactEmail ?? ""} /></label></div>
      </div>
    </FormCard>
    <FormCard title="Payment provider account" onSubmit={(form) => saveBookingPaymentAccount(propertyId, new FormData(form))}>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <input type="hidden" name="accountId" value={account?.id ?? "00000000-0000-0000-0000-000000000000"} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}><label>Provider<select name="provider" defaultValue="PAYSTACK"><option>PAYSTACK</option></select></label><label>Mode<select name="mode" defaultValue={account?.mode ?? "PLATFORM"}><option>PLATFORM</option><option>CUSTOMER</option></select></label><label>Currency<input name="currency" defaultValue={account?.currency ?? "NGN"} /></label></div>
        <label>Public key<input name="publicKey" defaultValue={account?.publicKey ?? ""} /></label><label>Secret environment variable name<input name="secretRef" defaultValue={account?.secretRef ?? ""} placeholder="PAYSTACK_SECRET_KEY" /></label><label>Webhook secret environment variable name<input name="webhookSecretRef" defaultValue={account?.webhookSecretRef ?? ""} /></label>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Raw provider secrets are never stored. Only environment-variable references are saved.</p>
      </div>
    </FormCard>
    <FormCard title="Custom domain and DNS verification" onSubmit={(form) => saveBookingDomain(propertyId, new FormData(form))}>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}><label>Custom domain<input name="customDomain" defaultValue={site?.customDomain ?? ""} placeholder="book.example.com" /></label><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Status: <strong>{site?.domainStatus ?? "Not configured"}</strong></p>{site?.verificationToken && site.customDomain && <div style={{ fontSize: 12, lineHeight: 1.6 }}><div>Add these DNS records at your domain provider:</div><code style={{ display: "block", marginTop: 6, wordBreak: "break-all" }}>TXT · Name: _lodgecore-booking · Value: {site.verificationToken}</code><code style={{ display: "block", marginTop: 6, wordBreak: "break-all" }}>CNAME · Name: {site.customDomain.split(".")[0]} · Target: cname.vercel-dns.com</code><div style={{ marginTop: 6, color: "var(--text-muted)" }}>After DNS propagates, verify here. LodgeCore attaches the hostname to the Vercel project and Vercel provisions SSL automatically when VERCEL_API_TOKEN and VERCEL_PROJECT_ID are configured.</div></div>}<button type="button" className="portal-secondary-button" onClick={async () => { try { await verifyBookingDomain(propertyId); window.location.reload(); } catch (e: any) { window.alert(e.message ?? "Verification failed"); } }}>Verify DNS now</button></div>
    </FormCard>
  </div>;
}

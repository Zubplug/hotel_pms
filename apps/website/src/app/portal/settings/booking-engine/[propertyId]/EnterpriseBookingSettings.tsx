"use client";

import { useRef, useState, useTransition } from "react";
import { saveBookingContent, saveBookingPaymentAccount } from "./actions";

type Site = { siteName: string; content?: Record<string, any> | null };
type Account = { id: string; provider: string; mode: string; currency: string; publicKey: string | null; secretRef: string | null; webhookSecretRef: string | null } | null;

function FormCard({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (form: HTMLFormElement) => Promise<void> }) {
  const ref = useRef<HTMLFormElement>(null); const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  return <form ref={ref} className="portal-card" onSubmit={(e) => { e.preventDefault(); setMessage(""); start(async () => { try { await onSubmit(ref.current!); setMessage("Saved"); } catch (error: any) { setMessage(error.message ?? "Could not save"); } }); }}>
    <div className="portal-card-title">{title}</div>{children}<div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}><button disabled={pending} type="submit" className="portal-primary-button">{pending ? "Saving…" : "Save changes"}</button>{message && <span style={{ fontSize: 12, color: message === "Saved" ? "#15803d" : "#b42318" }}>{message}</span>}</div>
  </form>;
}

export function EnterpriseBookingSettings({ propertyId, site, account }: { propertyId: string; site: Site | null; account: Account }) {
  const content = site?.content ?? {};
  return <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
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
  </div>;
}

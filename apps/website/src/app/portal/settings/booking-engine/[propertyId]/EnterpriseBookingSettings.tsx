"use client";

import { useRef, useState, useTransition } from "react";
import {
  saveBookingContent,
  saveBookingDomain,
  saveBookingPaymentAccount,
  verifyBookingDomain,
} from "./actions";

type Site = {
  siteName: string;
  content?: Record<string, any> | null;
  customDomain?: string | null;
  domainStatus?: string | null;
  verificationToken?: string | null;
};
type Account = {
  id: string;
  provider: string;
  mode: string;
  currency: string;
  publicKey: string | null;
  secretRef: string | null;
  webhookSecretRef: string | null;
} | null;
type RequestState = { domain: string; status: string; notes: string | null } | null;
type WebsiteState = { status: string; brief: string | null } | null;

function FormCard({
  eyebrow,
  title,
  description,
  children,
  onSubmit,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  onSubmit: (form: HTMLFormElement) => Promise<void>;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  return (
    <form
      ref={ref}
      className="portal-card be-control-card"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        start(async () => {
          try {
            await onSubmit(ref.current!);
            setMessage({ text: "Saved", ok: true });
          } catch (error: any) {
            setMessage({ text: error.message ?? "Could not save", ok: false });
          }
        });
      }}
    >
      <div className="be-card-heading">
        <div>
          <div className="be-card-eyebrow">{eyebrow}</div>
          <div className="portal-card-title">{title}</div>
          <p className="be-card-description">{description}</p>
        </div>
      </div>
      {children}
      <div className="be-form-footer">
        <button disabled={pending} type="submit" className="btn btn-primary btn-sm">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {message && <span className={message.ok ? "be-save-ok" : "be-save-error"} role={message.ok ? "status" : "alert"}>{message.text}</span>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="be-field">
      <span className="be-field-label">{label}</span>
      {children}
      {hint && <span className="be-field-hint">{hint}</span>}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = ["ACTIVE", "PAID", "VERIFIED"].includes(status) ? "active" : status === "REJECTED" ? "danger" : "pending";
  return <span className={`be-status-pill ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

export type EnterpriseBookingSettingsProps = {
  propertyId: string;
  site: Site | null;
  account: Account;
  domainRequest: RequestState;
  websiteRequest: WebsiteState;
  section?: "content" | "payments" | "distribution";
};

export function EnterpriseBookingSettings({
  propertyId,
  site,
  account,
  domainRequest,
  websiteRequest,
  section,
}: EnterpriseBookingSettingsProps) {
  const content = site?.content ?? {};
  const [domainPending, startDomain] = useTransition();
  const [domainMessage, setDomainMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [paymentMode, setPaymentMode] = useState(account?.mode ?? "PLATFORM");

  const runDomainVerification = () => {
    setDomainMessage(null);
    startDomain(async () => {
      try {
        await verifyBookingDomain(propertyId);
        setDomainMessage({ text: "Domain verified and connected", ok: true });
      } catch (error: any) {
        setDomainMessage({ text: error.message ?? "Verification failed", ok: false });
      }
    });
  };

  return (
    <section className="be-enterprise-settings" aria-label="Advanced booking engine controls">
      {(!section || section === "content") && <>
      <div className="be-section-heading"><div><span className="be-section-index">03</span> Guest experience</div><span>Guest-facing content</span></div>
      <div className="be-control-grid">
        <FormCard eyebrow="Content layer" title="Guest-facing content" description="Shape the message guests see before they choose a room. Keep policies and contact details explicit to reduce booking friction." onSubmit={(form) => saveBookingContent(propertyId, new FormData(form))}>
          <div className="be-form-stack">
            <Field label="Hero title"><input name="heroTitle" defaultValue={content.heroTitle ?? content.tagline ?? "Welcome"} /></Field>
            <Field label="Hero subtitle"><textarea name="heroSubtitle" defaultValue={content.heroSubtitle ?? "Book direct for the best available rate."} rows={3} /></Field>
            <Field label="Amenities" hint="One amenity per line"><textarea name="amenities" defaultValue={Array.isArray(content.amenities) ? content.amenities.join("\n") : ""} rows={4} /></Field>
            <Field label="Cancellation policy"><textarea name="cancellationText" defaultValue={content.cancellationText ?? "Cancellation policy applies according to the selected rate plan."} rows={3} /></Field>
            <div className="be-two-col">
              <Field label="Contact phone"><input name="contactPhone" defaultValue={content.contactPhone ?? ""} /></Field>
              <Field label="Contact email"><input name="contactEmail" type="email" defaultValue={content.contactEmail ?? ""} /></Field>
            </div>
          </div>
        </FormCard>

      </div>
      </>}

      {(!section || section === "payments") && <>
      <div className="be-section-heading be-section-heading-spaced"><div><span className="be-section-index">04</span> Payments</div><span>Production controls</span></div>
      <div className="be-control-grid">
        <FormCard eyebrow="Payments" title="Online payment account" description="Connect the live gateway used for deposits and full-payment bookings. Secrets remain environment references, never raw credentials." onSubmit={(form) => saveBookingPaymentAccount(propertyId, new FormData(form))}>
          <div className="be-form-stack">
            <input type="hidden" name="accountId" value={account?.id ?? "00000000-0000-0000-0000-000000000000"} readOnly />
            <Field label="Payment account">
              <select name="mode" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
                <option value="PLATFORM">LodgeCore manages payments</option>
                <option value="CUSTOMER">Property manages payments</option>
              </select>
            </Field>
            {paymentMode === "PLATFORM" ? <>
              <input type="hidden" name="provider" value="PAYSTACK" readOnly />
              <input type="hidden" name="currency" value={account?.currency ?? "NGN"} readOnly />
              <div className="be-managed-payment">
                <div className="be-managed-payment-icon">✓</div>
                <div>
                  <strong>Payments managed by LodgeCore</strong>
                  <p>Online deposits and full-payment checkouts use LodgeCore’s secure Paystack connection. No gateway keys or technical credentials are required from your team.</p>
                </div>
                <span className="be-status-pill active">Paystack · {account?.currency ?? "NGN"}</span>
              </div>
            </> : <>
              <div className="be-three-col">
                <Field label="Provider"><select name="provider" defaultValue={account?.provider ?? "PAYSTACK"}><option value="PAYSTACK">Paystack</option></select></Field>
                <Field label="Currency"><input name="currency" defaultValue={account?.currency ?? "NGN"} /></Field>
              </div>
              <Field label="Public key"><input name="publicKey" defaultValue={account?.publicKey ?? ""} placeholder="pk_live_…" /></Field>
              <Field label="Secret environment variable"><input name="secretRef" defaultValue={account?.secretRef ?? ""} placeholder="PAYSTACK_SECRET_KEY" /></Field>
              <Field label="Webhook environment variable"><input name="webhookSecretRef" defaultValue={account?.webhookSecretRef ?? ""} placeholder="PAYSTACK_WEBHOOK_SECRET" /></Field>
              <div className="be-security-note">⌁ Payment webhooks are verified server-side before a reservation is marked paid.</div>
            </>}
          </div>
        </FormCard>
      </div>
      </>}

      {(!section || section === "distribution") && <>
      <div className="be-section-heading be-section-heading-spaced"><div><span className="be-section-index">05</span> Distribution & growth</div><span>Optional services</span></div>
      <div className="be-control-grid">
        <FormCard eyebrow="Custom domain" title="Own your booking address" description="Use a branded domain such as book.yourhotel.com. Domain activation is configured by LodgeCore HQ after payment." onSubmit={(form) => domainRequest ? saveBookingDomain(propertyId, new FormData(form)) : Promise.resolve()}>
          <div className="be-domain-status">
            <div><span className="be-field-label">Current request</span><strong>{domainRequest?.domain ?? "No request yet"}</strong></div>
            {domainRequest && <StatusPill status={domainRequest.status} />}
          </div>
          {!domainRequest || domainRequest.status === "REJECTED" ? (
            <div className="be-form-stack"><p className="be-field-hint">Check availability and pay for a custom domain from the Subscription add-ons flow. Booking Engine will be included automatically when required.</p><a href="/portal/subscription" className="btn btn-primary btn-sm">Open subscription add-ons →</a></div>
          ) : domainRequest.status !== "ACTIVE" ? (
            <p className="be-field-hint">Your request is being handled by LodgeCore. Once it is activated, the DNS connection controls will appear here.</p>
          ) : (
            <div className="be-form-stack"><Field label="Activated domain"><input name="customDomain" defaultValue={site?.customDomain ?? domainRequest.domain} placeholder="book.yourhotel.com" /></Field><div className="be-domain-actions"><button disabled={domainPending} type="submit" className="btn btn-outline btn-sm">{domainPending ? "Saving…" : "Save domain"}</button>{site?.customDomain && <button type="button" disabled={domainPending} onClick={runDomainVerification} className="btn btn-primary btn-sm">{domainPending ? "Checking DNS…" : "Verify DNS"}</button>}</div>{site?.verificationToken && <p className="be-field-hint">Add this TXT value at your DNS host: <code>{site.verificationToken}</code></p>}{domainMessage && <span className={domainMessage.ok ? "be-save-ok" : "be-save-error"}>{domainMessage.text}</span>}</div>
          )}
        </FormCard>

        <FormCard eyebrow="White-glove service" title="Custom website design" description="Website briefs, domain availability, Booking Engine bundling and payment are handled from the subscription portal." onSubmit={() => Promise.resolve()}>
          {websiteRequest ? <div className="be-request-summary"><StatusPill status={websiteRequest.status} /><p>{websiteRequest.brief ?? "Your custom website request is being processed."}</p></div> : <div className="be-form-stack"><p className="be-field-hint">Open Subscription → Add-ons to start the professional website brief and checkout flow.</p><a href="/portal/subscription" className="btn btn-primary btn-sm">Open subscription add-ons →</a></div>}
        </FormCard>
      </div>
      </>}

    </section>
  );
}

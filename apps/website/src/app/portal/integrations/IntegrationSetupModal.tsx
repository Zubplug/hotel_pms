"use client";

import { useEffect, useMemo, useState } from "react";
import { saveBookingPaymentAccount } from "../settings/booking-engine/[propertyId]/actions";

type Property = {
  id: string;
  name: string;
  targets: string[];
  account: { id: string; provider: string; mode: string; target: string; currency: string; configured: boolean } | null;
};

export function IntegrationSetupModal({ onClose }: { onClose: () => void }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [target, setTarget] = useState("STANDALONE_API");
  const [secret, setSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [status, setStatus] = useState("Loading properties…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/portal/integrations/properties")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load properties");
        return response.json();
      })
      .then((payload) => {
        setProperties(payload.properties ?? []);
        if (payload.properties?.[0]) {
          setPropertyId(payload.properties[0].id);
          setTarget(payload.properties[0].targets.includes("STANDALONE_API") ? "STANDALONE_API" : "BOOKING_ENGINE");
        }
        setStatus("");
      })
      .catch((error) => setStatus(error.message));
  }, []);

  const property = properties.find((item) => item.id === propertyId) ?? null;
  const targets = useMemo(() => Array.from(new Set(property?.targets ?? [])), [property]);

  function changeProperty(value: string) {
    const next = properties.find((item) => item.id === value);
    setPropertyId(value);
    setTarget(next?.targets.includes("STANDALONE_API") ? "STANDALONE_API" : "BOOKING_ENGINE");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!property || !target) return;
    setSaving(true);
    setStatus("");
    try {
      const form = new FormData(event.currentTarget);
      form.set("accountId", property.account?.id ?? "00000000-0000-0000-0000-000000000000");
      form.set("provider", "FLUTTERWAVE");
      form.set("mode", "CUSTOMER");
      form.set("target", target);
      await saveBookingPaymentAccount(property.id, form);
      setStatus("Flutterwave payment settings saved securely.");
      setSecret("");
      setWebhookSecret("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save payment settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="portal-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payment-setup-title" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(3, 12, 20, .68)" }}>
      <div className="portal-card" onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 620px)", padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div className="portal-page-kicker">Customer-owned gateway</div>
            <h2 id="payment-setup-title" style={{ margin: "6px 0 8px" }}>Configure Flutterwave</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Payments go directly to your Flutterwave account. Credentials are encrypted before they are stored.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="btn btn-outline btn-sm">×</button>
        </div>

        {status && <div style={{ margin: "16px 0", padding: 12, borderRadius: 8, background: "var(--bg-overlay)", color: status.includes("saved") ? "var(--success)" : "var(--text-muted)", fontSize: 13 }}>{status}</div>}

        {properties.length > 0 && (
          <form onSubmit={submit}>
            <label className="be-field"><span className="be-field-label">Property</span><select value={propertyId} onChange={(event) => changeProperty(event.target.value)}><option value="">Select property</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div style={{ marginTop: 16 }}><span className="be-field-label">Payment target</span><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 8 }}>{targets.map((value) => <label key={value} style={{ display: "block", padding: 14, border: `1px solid ${target === value ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer" }}><input type="radio" name="paymentTarget" value={value} checked={target === value} onChange={() => setTarget(value)} style={{ marginRight: 8 }} />{value === "STANDALONE_API" ? "Standalone API" : value === "PMS_WEBSITE" ? "PMS Website" : "Booking Engine"}<small style={{ display: "block", color: "var(--text-muted)", margin: "6px 0 0 22px" }}>{value === "STANDALONE_API" ? "Your custom website reservations" : value === "PMS_WEBSITE" ? "Your LodgeCore PMS website" : "LodgeCore booking site reservations"}</small></label>)}</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              <label className="be-field"><span className="be-field-label">Flutterwave secret key</span><input name="customerSecret" value={secret} onChange={(event) => setSecret(event.target.value)} type="password" autoComplete="new-password" placeholder={property?.account?.configured ? "Leave blank to keep saved key" : "FLWSECK-…"} /></label>
              <label className="be-field"><span className="be-field-label">Webhook secret hash</span><input name="customerWebhookSecret" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} type="password" autoComplete="new-password" placeholder={property?.account?.configured ? "Leave blank to keep saved secret" : "Secret hash"} /></label>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14 }}>Set your Flutterwave webhook URL to <code>https://getlodgecore.vercel.app/api/v1/public/payment/webhook</code>.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}><button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary btn-sm" disabled={saving || !propertyId || !target}>{saving ? "Saving…" : "Save configuration"}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

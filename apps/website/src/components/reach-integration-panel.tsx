"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReachProperty = {
  id: string;
  name: string;
  entitled: boolean;
  enabled: boolean;
  activationPaymentStatus: string;
  pausedAt: string | null;
};

export function ReachIntegrationPanel() {
  const [properties, setProperties] = useState<ReachProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/portal/reach-program", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load Reach settings");
      const payload = await response.json();
      setProperties(payload.properties ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Reach settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(property: ReachProperty) {
    setBusy(property.id);
    setError(null);
    try {
      const response = await fetch("/api/portal/reach-program", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: property.id, enabled: !property.enabled }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update Reach settings");
      setProperties((current) => current.map((item) => item.id === property.id ? { ...item, enabled: payload.enabled } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update Reach settings");
    } finally {
      setBusy(null);
    }
  }

  return <section className="portal-card" style={{ marginBottom: 24, borderColor: "rgba(167,139,250,.35)", background: "linear-gradient(135deg, rgba(167,139,250,.08), transparent 60%)" }}>
    <div className="portal-card-title" style={{ marginBottom: 4 }}>
      LodgeCore Reach Referral Network
      <span className="portal-badge badge-active">ADDON_REACH</span>
    </div>
    <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
      Control referral attribution for each property with an active Reach add-on. Disabling pauses new referral activity without deleting historical records.
    </p>
    {loading ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading Reach settings…</p> : properties.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No active properties found.</p> : <div style={{ display: "grid", gap: 10 }}>
      {properties.map((property) => <div key={property.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "rgba(0,0,0,.08)" }}>
        <div>
          <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>{property.name}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>{property.entitled ? (property.enabled ? "Referral network is active" : "Add-on active; referral network paused") : "Reach add-on is not active"}</div>
        </div>
        {property.entitled ? <button type="button" className={`btn btn-${property.enabled ? "outline" : "primary"} btn-sm`} onClick={() => void toggle(property)} disabled={busy === property.id}>{busy === property.id ? "Saving…" : property.enabled ? "Disable Reach" : "Enable Reach"}</button> : <Link href="/portal/subscription" className="btn btn-outline btn-sm">Activate add-on →</Link>}
      </div>)}
    </div>}
    {error && <p role="alert" style={{ color: "var(--danger, #ef6b73)", fontSize: 12, margin: "14px 0 0" }}>{error}</p>}
  </section>;
}

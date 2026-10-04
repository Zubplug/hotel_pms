"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticateBeds24, connectBeds24 } from "./actions";

export default function Beds24Setup({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [refreshToken, setRefreshToken] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function authenticate() {
    setBusy(true); setMessage(null);
    const result = await authenticateBeds24(inviteCode, webhookSecret);
    if (result.success) { setProperties(result.properties ?? []); setRefreshToken(result.refreshToken ?? ""); setMessage({ type: "success", text: "Beds24 authenticated. Select the property to connect." }); }
    else setMessage({ type: "error", text: result.error ?? "Authentication failed." });
    setBusy(false);
  }

  async function connect() {
    setBusy(true); setMessage(null);
    const result = await connectBeds24({ externalPropertyId: selectedProperty, refreshToken, webhookSecret });
    if (result.success) { setMessage({ type: "success", text: "Beds24 connected successfully." }); router.refresh(); }
    else setMessage({ type: "error", text: result.error ?? "Connection failed." });
    setBusy(false);
  }

  return <div className="portal-card" style={{ maxWidth: 720 }}>
    <div className="portal-card-title">{connected ? "Beds24 connected" : "Connect Beds24"}</div>
    <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.7, margin: "8px 0 18px" }}>Create a Beds24 API v2 invite code with Properties, Bookings and Inventory access. Choose a private webhook secret; you will use it in Beds24 webhook settings.</p>
    <div style={{ display: "grid", gap: 12 }}>
      <label>Invite code<input className="portal-input" type="password" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Beds24 API v2 invite code" /></label>
      <label>Webhook secret<input className="portal-input" type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Create a private webhook token" /></label>
      {properties.length > 0 && <label>Beds24 property<select className="portal-input" value={selectedProperty} onChange={(event) => setSelectedProperty(event.target.value)}><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name} ({property.id})</option>)}</select></label>}
      {message && <div role="status" style={{ color: message.type === "success" ? "var(--mint)" : "#ff7b8d", fontSize: 13 }}>{message.text}</div>}
      <div style={{ display: "flex", gap: 10 }}><button className="btn btn-primary btn-sm" onClick={properties.length ? connect : authenticate} disabled={busy || (properties.length ? !selectedProperty : !inviteCode || !webhookSecret)}>{busy ? "Working…" : properties.length ? "Connect property" : "Authenticate Beds24"}</button><a className="btn btn-outline btn-sm" href="https://beds24.com" target="_blank" rel="noreferrer">Open Beds24 ↗</a></div>
    </div>
  </div>;
}

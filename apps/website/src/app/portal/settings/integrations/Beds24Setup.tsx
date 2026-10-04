"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticateBeds24, connectBeds24, disconnectBeds24 } from "./actions";

type Property = { id: string; name: string };

export default function Beds24Setup({
  connection,
}: {
  connection: { externalPropertyId: string; status: string; lastSuccessfulSync: Date | null; roomMappings: number; ratePlanMappings: number } | null;
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(connection?.externalPropertyId ?? "");
  const [property, setProperty] = useState<Property | null>(connection?.status === "CONNECTED" ? { id: connection.externalPropertyId, name: "Connected Beds24 property" } : null);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  function generateSecret() {
    setWebhookSecret(`lc_${crypto.randomUUID().replaceAll("-", "")}`);
    setShowSecret(true);
  }

  async function verifyProperty() {
    setBusy(true); setMessage(null);
    const result = await authenticateBeds24(propertyId);
    if (result.success) {
      setProperty(result.property ?? null);
      setMessage({ type: "success", text: "Property verified. LodgeCore can access the activated Beds24 account." });
    } else setMessage({ type: "error", text: result.error ?? "Property verification failed." });
    setBusy(false);
  }

  async function connect() {
    setBusy(true); setMessage(null);
    const result = await connectBeds24({ externalPropertyId: propertyId, webhookSecret });
    if (result.success) {
      setMessage({ type: "success", text: "Beds24 is connected. Initial synchronization can now begin." });
      router.refresh();
    } else setMessage({ type: "error", text: result.error ?? "Connection failed." });
    setBusy(false);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Beds24 from this property? Synchronization will stop.")) return;
    setBusy(true); setMessage(null);
    const result = await disconnectBeds24();
    if (result.success) { setMessage({ type: "success", text: "Beds24 disconnected." }); router.refresh(); }
    else setMessage({ type: "error", text: result.error ?? "Unable to disconnect Beds24." });
    setBusy(false);
  }

  const connected = connection?.status === "CONNECTED";
  const verified = Boolean(property);
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/v1/webhooks/ota/beds24` : "/api/v1/webhooks/ota/beds24";

  return (
    <div className="beds24-settings">
      <section className="beds24-hero">
        <div>
          <div className="beds24-eyebrow"><span className="beds24-live-dot" /> LodgeCore reseller connection</div>
          <h2>Connect your Beds24 property</h2>
          <p>LodgeCore manages the Beds24 partner connection securely. You only activate LodgeCore in Beds24, verify your property, and choose where booking events should be delivered.</p>
        </div>
        <div className={`beds24-status ${connected ? "is-connected" : ""}`}><span />{connected ? "Connected" : "Not connected"}</div>
      </section>

      <div className="beds24-grid">
        <section className="beds24-card beds24-flow-card">
          <div className="beds24-card-heading"><div><span className="beds24-index">01</span><h3>Activate the partner connection</h3></div><span className="beds24-check">Marketplace</span></div>
          <p className="beds24-muted">In your Beds24 control panel, open <strong>Marketplace</strong>, find LodgeCore, and activate the integration for the room types you want to synchronize. No API key or invite code is required from your team.</p>
          <a className="beds24-secondary-button" href="https://beds24.com" target="_blank" rel="noreferrer">Open Beds24 <span>↗</span></a>
          <div className="beds24-note"><span>i</span><p>Only room types enabled for LodgeCore in Beds24 are visible to the reseller API.</p></div>
        </section>

        <section className="beds24-card beds24-flow-card">
          <div className="beds24-card-heading"><div><span className="beds24-index">02</span><h3>Verify your property</h3></div><span className={verified ? "beds24-check" : "beds24-pending"}>{verified ? "Verified" : "Required"}</span></div>
          <p className="beds24-muted">Enter the numeric property ID shown in Beds24. LodgeCore validates access against the live reseller connection before saving anything.</p>
          <label className="beds24-label">Beds24 property ID<input className="beds24-input" inputMode="numeric" value={propertyId} onChange={(event) => setPropertyId(event.target.value.replace(/\D/g, ""))} placeholder="e.g. 12345" /></label>
          {property && <div className="beds24-verified"><span>✓</span><div><strong>{property.name}</strong><small>Beds24 property {property.id}</small></div></div>}
          <button className="beds24-primary-button" type="button" onClick={verifyProperty} disabled={busy || !propertyId}>{busy ? "Checking…" : verified ? "Verify again" : "Verify property"}<span>→</span></button>
        </section>
      </div>

      <section className="beds24-card beds24-connection-card">
        <div className="beds24-card-heading"><div><span className="beds24-index">03</span><h3>Connect inbound booking events</h3></div><span className="beds24-secure">Encrypted at rest</span></div>
        <div className="beds24-webhook-grid">
          <div><p className="beds24-muted">Create a private webhook secret, then add this endpoint in the Beds24 property webhook settings. LodgeCore verifies every inbound event before processing it.</p><label className="beds24-label">Webhook verification secret<div className="beds24-secret-row"><input className="beds24-input" type={showSecret ? "text" : "password"} value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Generate a private secret" /><button type="button" className="beds24-ghost-button" onClick={() => setShowSecret((value) => !value)}>{showSecret ? "Hide" : "Show"}</button><button type="button" className="beds24-ghost-button" onClick={generateSecret}>Generate</button></div></label></div>
          <div className="beds24-endpoint"><span>Webhook endpoint</span><code>{webhookUrl}</code><small>Use the same secret in Beds24. Never share it in email or support tickets.</small></div>
        </div>
        <div className="beds24-actions"><button className="beds24-primary-button" type="button" onClick={connect} disabled={busy || !verified || !webhookSecret.trim()}>{busy ? "Saving…" : connected ? "Save connection" : "Connect Beds24"}<span>→</span></button>{connected && <button className="beds24-danger-button" type="button" onClick={disconnect} disabled={busy}>Disconnect</button>}</div>
        {message && <div className={`beds24-message ${message.type}`} role="status"><span>{message.type === "success" ? "✓" : "!"}</span>{message.text}</div>}
      </section>

      <section className="beds24-card beds24-health-card">
        <div className="beds24-card-heading"><div><span className="beds24-index">04</span><h3>Sync readiness</h3></div><span className="beds24-muted">Operational view</span></div>
        {connection ? <div className="beds24-health-grid"><div><span>Connection</span><strong className={connection.status === "CONNECTED" ? "green" : "amber"}>{connection.status}</strong></div><div><span>Rooms mapped</span><strong>{connection.roomMappings}</strong></div><div><span>Rates mapped</span><strong>{connection.ratePlanMappings}</strong></div><div><span>Last successful sync</span><strong>{connection.lastSuccessfulSync ? new Date(connection.lastSuccessfulSync).toLocaleString() : "Not yet"}</strong></div></div> : <p className="beds24-muted">Connect the property to unlock room and rate mapping health.</p>}
      </section>

      <style>{`.beds24-settings{display:grid;gap:18px;max-width:1120px}.beds24-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:28px 30px;border:1px solid rgba(91,226,205,.16);border-radius:20px;background:radial-gradient(circle at 90% 10%,rgba(0,212,232,.13),transparent 34%),linear-gradient(135deg,#0d1b2b,#0a1422);box-shadow:0 20px 60px rgba(0,0,0,.16)}.beds24-eyebrow,.beds24-label,.beds24-index,.beds24-endpoint span{font-family:var(--font-mono,monospace);font-size:10px;letter-spacing:.14em;text-transform:uppercase}.beds24-eyebrow{color:#5be6d0}.beds24-live-dot{display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#5be6d0;box-shadow:0 0 12px #5be6d0}.beds24-hero h2{margin:10px 0 8px;color:var(--text-primary,#edf7fb);font-size:clamp(24px,3vw,36px);letter-spacing:-.05em}.beds24-hero p,.beds24-muted{color:var(--text-muted,#91a4b5);font-size:13px;line-height:1.7}.beds24-hero p{max-width:670px;margin:0}.beds24-status,.beds24-check,.beds24-pending,.beds24-secure{white-space:nowrap;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:7px 11px;color:#9aabba;font:10px var(--font-mono,monospace);text-transform:uppercase;letter-spacing:.09em}.beds24-status span{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:7px;background:#8797a6}.beds24-status.is-connected,.beds24-check{color:#67e6b4;background:rgba(65,226,162,.08);border-color:rgba(65,226,162,.2)}.beds24-status.is-connected span{background:#67e6b4;box-shadow:0 0 10px #67e6b4}.beds24-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.beds24-card{border:1px solid rgba(255,255,255,.09);border-radius:18px;background:linear-gradient(145deg,rgba(16,30,48,.98),rgba(10,20,33,.98));padding:24px;box-shadow:0 14px 38px rgba(0,0,0,.12)}.beds24-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.beds24-card-heading>div{display:flex;align-items:flex-start;gap:12px}.beds24-index{color:#08d7ed;padding-top:4px}.beds24-card h3{margin:0;color:#eaf4f7;font-size:16px;letter-spacing:-.02em}.beds24-check,.beds24-pending,.beds24-secure{font-size:9px;padding:5px 8px}.beds24-pending{color:#f7ca73;background:rgba(247,202,115,.07);border-color:rgba(247,202,115,.2)}.beds24-secure{color:#9eb5c5}.beds24-note{display:flex;gap:9px;margin-top:18px;padding:11px 12px;border-radius:11px;background:rgba(0,212,232,.05);color:#92a8b6}.beds24-note span{display:grid;place-items:center;flex:0 0 17px;height:17px;border:1px solid #4bc8d5;border-radius:50%;color:#4bc8d5;font-size:11px}.beds24-note p{margin:0;font-size:11px;line-height:1.5}.beds24-label{display:grid;gap:8px;color:#738b9e;margin-top:18px}.beds24-input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#0a1726;color:#edf7fb;padding:12px 13px;font:13px inherit;outline:none}.beds24-input:focus{border-color:#16cee2;box-shadow:0 0 0 3px rgba(22,206,226,.1)}.beds24-verified{display:flex;align-items:center;gap:10px;margin-top:14px;padding:11px;border:1px solid rgba(65,226,162,.18);border-radius:11px;background:rgba(65,226,162,.06);color:#70e7ba}.beds24-verified span{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:rgba(65,226,162,.16)}.beds24-verified strong,.beds24-verified small{display:block}.beds24-verified small{margin-top:3px;color:#8da5af;font-size:11px}.beds24-primary-button,.beds24-secondary-button,.beds24-ghost-button,.beds24-danger-button{border:0;border-radius:10px;cursor:pointer;font:600 12px inherit}.beds24-primary-button{display:inline-flex;align-items:center;justify-content:space-between;gap:18px;margin-top:16px;padding:11px 14px;background:#1264e8;color:#fff}.beds24-primary-button:disabled{opacity:.45;cursor:not-allowed}.beds24-secondary-button{display:inline-flex;gap:18px;margin-top:16px;padding:10px 13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#d9e8ed;text-decoration:none}.beds24-webhook-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:24px}.beds24-secret-row{display:flex;gap:7px}.beds24-secret-row .beds24-input{flex:1}.beds24-ghost-button{padding:0 11px;background:rgba(255,255,255,.06);color:#a9bdc7}.beds24-endpoint{display:grid;align-content:center;gap:8px;padding:16px;border:1px dashed rgba(0,212,232,.24);border-radius:12px;background:rgba(0,212,232,.04)}.beds24-endpoint span{color:#5be6d0}.beds24-endpoint code{overflow-wrap:anywhere;color:#e0f7fa;font-size:11px}.beds24-endpoint small{color:#8399a8;line-height:1.5}.beds24-actions{display:flex;align-items:center;gap:12px;margin-top:6px}.beds24-danger-button{padding:11px 14px;background:rgba(255,94,115,.08);color:#ff9dab;border:1px solid rgba(255,94,115,.18)}.beds24-message{display:flex;gap:8px;align-items:center;margin-top:16px;padding:11px 13px;border-radius:10px;font-size:12px}.beds24-message.success{background:rgba(65,226,162,.08);color:#73e8bc}.beds24-message.error{background:rgba(255,94,115,.08);color:#ff9dab}.beds24-health-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.beds24-health-grid>div{display:grid;gap:8px;padding:13px;border-radius:11px;background:rgba(255,255,255,.035)}.beds24-health-grid span{color:#718899;font:10px var(--font-mono,monospace);text-transform:uppercase;letter-spacing:.08em}.beds24-health-grid strong{color:#dcebef;font-size:13px}.beds24-health-grid strong.green{color:#6ce4b7}.beds24-health-grid strong.amber{color:#f2c66c}@media(max-width:760px){.beds24-hero,.beds24-grid,.beds24-webhook-grid{display:grid;grid-template-columns:1fr}.beds24-status{justify-self:start}.beds24-health-grid{grid-template-columns:repeat(2,1fr)}.beds24-card{padding:18px}.beds24-secret-row{flex-wrap:wrap}.beds24-secret-row .beds24-input{flex-basis:100%}}`}</style>
    </div>
  );
}

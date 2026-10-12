"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { IntegrationSetupModal } from "./IntegrationSetupModal";
import { CancellationPolicyIntegrationPanel } from "./CancellationPolicyIntegrationPanel";

const INTEGRATIONS = [
  { id: "paystack",    name: "Paystack",     type: "Payments",         icon: "💳", status: "not-connected", desc: "Legacy reservation payment provider." },
  { id: "flutterwave", name: "Flutterwave",  type: "Payments",         icon: "🔄", status: "available",     desc: "Connect your own Flutterwave account for reservations and automatic payroll salary payments." },
  { id: "booking-com", name: "Booking.com",  type: "Distribution",     icon: "🌐", status: "not-connected", desc: "Two-way channel sync." },
  { id: "expedia",     name: "Expedia",      type: "Distribution",     icon: "✈️", status: "not-connected", desc: "Expedia Group network." },
  { id: "whatsapp",    name: "WhatsApp",     type: "Communications",   icon: "💬", status: "not-connected", desc: "Automated guest messaging." },
  { id: "dormakaba",   name: "Dormakaba",    type: "Access Control",   icon: "🔑", status: "not-connected", desc: "Key card encoding from the desk." },
  { id: "salto",       name: "Salto",        type: "Access Control",   icon: "🚪", status: "not-connected", desc: "Mobile key issuance and access logs." },
  { id: "open-apis",   name: "Open APIs",    type: "Developer",        icon: "⚡", status: "live",         desc: "REST endpoints and webhooks." },
];

const statusClass: Record<string, string> = {
  live: "badge-active",
  pending: "badge-pending",
  available: "badge-pending",
  "not-connected": "badge-inactive",
};

type IntegrationProperty = {
  id: string;
  name: string;
  account: {
    provider: string;
    mode: string;
    target: string;
    currency: string;
    configured: boolean;
  } | null;
};

export default function PortalIntegrationsPage() {
  const [requesting, setRequesting] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [payrollSetupOpen, setPayrollSetupOpen] = useState(false);
  const [properties, setProperties] = useState<IntegrationProperty[]>([]);

  const loadIntegrationProperties = () => {
    fetch("/api/portal/integrations/properties")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load integration status")))
      .then((payload) => setProperties(payload.properties ?? []))
      .catch(() => setProperties([]));
  };

  useEffect(() => {
    loadIntegrationProperties();
  }, []);

  const configuredFlutterwaveProperties = useMemo(
    () => properties.filter((property) => property.account?.provider === "FLUTTERWAVE" && property.account.configured),
    [properties]
  );
  const flutterwaveConfigured = configuredFlutterwaveProperties.length > 0;

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Integrations</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            Connected systems and API access for your organization.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={() => setPayrollSetupOpen(true)} className="btn btn-primary btn-sm">Configure payroll payouts</button><Link href="/portal/support" className="btn btn-outline btn-sm">Request integration →</Link></div>
      </div>

      {/* API credentials panel */}
      <div className="portal-card" style={{ marginBottom: 24 }}>
        <div className="portal-card-title">
          API access
          <span className="portal-badge badge-active">Active</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <div className="portal-stat-label">API base URL</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", marginTop: 6, padding: "8px 12px", background: "var(--bg-overlay)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              https://getlodgecore.vercel.app/api/v1/public
            </div>
          </div>
          <div>
            <div className="portal-stat-label">Authentication</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", marginTop: 6, padding: "8px 12px", background: "var(--bg-overlay)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              X-Publishable-Key header
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <Link href="/portal/api-access" className="btn btn-outline btn-sm">View API credentials →</Link>
          <a href="/api" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">View documentation ↗</a>
        </div>
      </div>

      <CancellationPolicyIntegrationPanel />

      {/* Integration list */}
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Integration</th>
              <th>Type</th>
              <th>Description</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {INTEGRATIONS.map((int) => (
              <tr key={int.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{int.icon}</span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{int.name}</span>
                  </div>
                </td>
                <td><span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>{int.type}</span></td>
                <td style={{ fontSize: 12 }}>
                  {int.id === "flutterwave" && flutterwaveConfigured
                    ? <>{int.desc}<div style={{ marginTop: 5, color: "var(--success)", fontSize: 11 }}>Configured for {configuredFlutterwaveProperties.length} {configuredFlutterwaveProperties.length === 1 ? "property" : "properties"}</div></>
                    : int.desc}
                </td>
                <td>
                  <span className={`portal-badge ${statusClass[int.id === "flutterwave" && flutterwaveConfigured ? "live" : int.status]}`}>
                  {int.id === "flutterwave" && flutterwaveConfigured ? "Connected" : int.status === "not-connected" ? "Not connected" : int.status === "available" ? "Available" : int.status}
                  </span>
                </td>
                <td>
                  {int.id === "flutterwave" ? (
                    <button type="button" onClick={() => setSetupOpen(true)} className={`btn btn-${flutterwaveConfigured ? "outline" : "primary"} btn-sm`} style={{ fontSize: 10, padding: "4px 10px" }}>{flutterwaveConfigured ? "Edit configuration" : "Configure"}</button>
                  ) : int.status === "live" ? (
                    <Link href="/portal/support" className="btn btn-outline btn-sm" style={{ fontSize: 10, padding: "4px 10px" }}>Manage</Link>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 10, padding: "4px 10px", border: "none" }}
                      onClick={() => setRequesting(int.id)}
                    >
                      {requesting === int.id ? "Requested ✓" : "Enable →"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="portal-card" style={{ marginTop: 16, background: "transparent", border: "1px solid var(--border)" }}>
        <div className="portal-card-title" style={{ marginBottom: 4 }}>Need a different connection?</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          LodgeCore's Open API layer supports custom integrations. Raise a support ticket with your requirements.
        </p>
        <Link href="/portal/support" className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>Request custom integration →</Link>
      </div>
      {flutterwaveConfigured && (
        <div className="portal-card" style={{ marginTop: 16, borderColor: "color-mix(in srgb, var(--success) 35%, var(--border))" }}>
          <div className="portal-card-title" style={{ marginBottom: 8 }}>Flutterwave connection</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Customer-owned Flutterwave payments are connected. The same verified account is reused for eligible payroll salary payments; credentials are encrypted and never displayed again.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {configuredFlutterwaveProperties.map((property) => (
              <span key={property.id} className="portal-badge badge-active">
                {property.name} · {property.account?.target === "STANDALONE_API" ? "Standalone API" : property.account?.target === "PMS_WEBSITE" ? "PMS Website" : "Booking Engine"}
              </span>
            ))}
          </div>
          <button type="button" onClick={() => setSetupOpen(true)} className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>Edit Flutterwave settings →</button>
        </div>
      )}
      {setupOpen && <IntegrationSetupModal onClose={() => setSetupOpen(false)} onSaved={loadIntegrationProperties} />}
      {payrollSetupOpen && <IntegrationSetupModal payrollOnly onClose={() => setPayrollSetupOpen(false)} onSaved={() => { setPayrollSetupOpen(false); loadIntegrationProperties(); }} />}
    </PortalShell>
  );
}

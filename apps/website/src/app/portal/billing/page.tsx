"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PortalShell } from "@/components/portal-shell";

export default function BillingPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Array<{ id: string; status: string; currency: string; total: number; amountDue: number; createdAt: string; hostedInvoiceUrl: string | null; invoicePdf: string | null }>>([]);

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((response) => response.ok ? response.json() : { invoices: [] })
      .then((payload) => setInvoices(Array.isArray(payload.invoices) ? payload.invoices : []))
      .catch(() => undefined);
  }, []);

  async function handleCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== "string") throw new Error(payload.error || "Unable to open billing portal");
      window.location.assign(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open billing portal");
      setBusy(false);
    }
  }

  return (
    <PortalShell>
      <div className="portal-page-header">
        <div>
          <div className="portal-page-kicker">Customer workspace</div>
          <h1 className="portal-page-title">Billing</h1>
          <p className="portal-page-sub" style={{ marginBottom: 0 }}>
            Invoices, payment details and subscription management.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleCheckout} disabled={busy}>
          {busy ? "Opening…" : "Manage billing →"}
        </button>
      </div>

      {/* Flutterwave billing support */}
      <div className="portal-card" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div className="portal-card-title" style={{ marginBottom: 6 }}>Flutterwave billing</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Access your invoices through LodgeCore. Payment-method changes and subscription cancellation are handled securely by the LodgeCore finance team through Flutterwave.
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={handleCheckout} disabled={busy} style={{ border: "none" }}>
              {busy ? "Contacting team…" : "Request billing change →"}
            </button>
            <Link href="/portal/subscription" className="btn btn-outline btn-sm">View subscription</Link>
          </div>
        </div>
        <div style={{
          width: 80, height: 80,
          borderRadius: "var(--radius-lg)",
          background: "var(--accent-dim)",
          border: "1px solid var(--border-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          flexShrink: 0,
        }}>
          💳
        </div>
      </div>

      {error && <div className="portal-card" role="alert" style={{ marginTop: 16, color: "var(--danger, #b42318)" }}>{error}</div>}

      {/* Info panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="portal-card">
          <div className="portal-card-title" style={{ marginBottom: 10 }}>Invoices</div>
          {invoices.length ? <div className="portal-table-wrap" style={{ marginBottom: 14 }}><table className="portal-table"><thead><tr><th>Date</th><th>Status</th><th>Total</th><th /></tr></thead><tbody>{invoices.slice(0, 5).map((invoice) => <tr key={invoice.id}><td>{new Date(invoice.createdAt).toLocaleDateString("en-GB")}</td><td><span className="portal-badge badge-active">{invoice.status}</span></td><td>{invoice.currency.toUpperCase()} {(invoice.total / 100).toLocaleString()}</td><td>{(invoice.invoicePdf || invoice.hostedInvoiceUrl) && <a className="btn btn-outline btn-sm" href={invoice.invoicePdf || invoice.hostedInvoiceUrl || "#"} target="_blank" rel="noreferrer">View</a>}</td></tr>)}</tbody></table></div> : <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 14 }}>Invoices will appear here after Flutterwave confirms your first billing cycle.</p>}
          <button className="btn btn-outline btn-sm" onClick={handleCheckout} disabled={busy}>Request billing support →</button>
        </div>

        <div className="portal-card">
          <div className="portal-card-title" style={{ marginBottom: 10 }}>Payment method</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
            Request a payment-method update or subscription cancellation from the LodgeCore finance team.
          </p>
          <button className="btn btn-outline btn-sm" onClick={handleCheckout}>Update payment →</button>
        </div>
      </div>

      {/* Contact note */}
      <div className="portal-card" style={{ marginTop: 8, background: "transparent", border: "1px solid var(--border)" }}>
        <div className="portal-card-title" style={{ marginBottom: 4 }}>Billing question?</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          For invoice disputes, custom billing arrangements or VAT questions, raise a support ticket and the LodgeCore finance team will assist.
        </p>
        <Link href="/portal/support" className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>Contact support →</Link>
      </div>
    </PortalShell>
  );
}

"use client";

import Link from "next/link";
import { PortalShell } from "@/components/portal-shell";

export default function BillingPage() {
  function handleCheckout() {
    // Will redirect to Stripe Customer Portal when billing is configured
    window.location.href = "/api/billing/portal";
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
        <button className="btn btn-primary btn-sm" onClick={handleCheckout}>
          Manage billing →
        </button>
      </div>

      {/* Stripe customer portal CTA */}
      <div className="portal-card" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div className="portal-card-title" style={{ marginBottom: 6 }}>Billing portal</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Access your invoices, update payment details, and manage subscription billing
            through the secure LodgeCore billing portal — powered by Stripe.
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={handleCheckout} style={{ border: "none" }}>
              Open billing portal →
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

      {/* Info panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="portal-card">
          <div className="portal-card-title" style={{ marginBottom: 10 }}>Invoices</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
            Download PDF invoices and view payment history through the billing portal.
          </p>
          <button className="btn btn-outline btn-sm" onClick={handleCheckout}>View invoices →</button>
        </div>

        <div className="portal-card">
          <div className="portal-card-title" style={{ marginBottom: 10 }}>Payment method</div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
            Update your card details or add a new payment method securely.
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

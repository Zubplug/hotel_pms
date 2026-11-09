"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

const roles = [
  ["GENERAL_MANAGER", "General Manager", "Executive dashboards, approvals and property oversight"],
  ["FRONT_DESK", "Front Desk / Receptionist", "Reservations, arrivals, departures and guest service"],
  ["HR_MANAGER", "HR Manager", "People operations, employee records and workforce workflows"],
  ["STOCK_MANAGER", "Stock Manager", "Inventory, stock control, transfers and purchasing"],
  ["GENERAL_CASHIER", "General Cashier", "Cash management, shifts and reconciliation"],
  ["NIGHT_AUDITOR", "Night Auditor", "Audit readiness, controls and business-date close"],
  ["ACCOUNTANT", "Accountant", "Ledger, journals and financial reporting"],
  ["FNB_MANAGER", "F&B Manager", "Outlet operations and menu management"],
] as const;

export default function DemoPage() {
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<{ email: string; password: string; pin: string; expiresAt: string; emailSent: boolean; managementLoginUrl: string; playStoreUrl: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("working");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/demo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        roleName: form.get("roleName"),
        website: form.get("website"),
        consent: form.get("consent") === "on",
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setError(body.error || "Unable to create the demo account.");
      return;
    }
    setCredentials({ ...body.credentials, expiresAt: body.expiresAt, emailSent: body.emailSent === true, managementLoginUrl: body.links?.managementLoginUrl || body.managementLoginUrl, playStoreUrl: body.links?.playStoreUrl || "https://play.google.com/store/apps/details?id=com.lodgecore.management" });
    setStatus("success");
  }

  return (
    <main className="site-shell">
      <PublicHeader />
      <section className="contain" style={{ padding: "120px 0 80px", maxWidth: 760 }}>
        <div className="section-kicker">LodgeCore sandbox</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem, 6vw, 4.5rem)", lineHeight: .95, letterSpacing: "-.07em", color: "var(--text-primary)", margin: "14px 0 18px" }}>
          Explore the platform with a temporary demo account.
        </h1>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 620 }}>
          Choose a role and receive secure web and mobile credentials for the LodgeCore demo property. The account expires automatically after 24 hours.
        </p>

        {status === "success" && credentials ? (
          <div className="portal-card" style={{ marginTop: 32, padding: 28, borderColor: "rgba(62,245,160,.28)" }}>
            <div className="section-kicker" style={{ color: "var(--mint)" }}>Demo access ready</div>
            <h2 style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", margin: "10px 0" }}>Keep these credentials secure</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>They work for the web portal and the mobile management app until {new Date(credentials.expiresAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}.</p>
            <p style={{ color: credentials.emailSent ? "var(--mint)" : "#fbbf24", fontSize: 13, lineHeight: 1.6 }}>{credentials.emailSent ? "Your access details were sent to your email address." : "We could not send the email, so copy these credentials before leaving this page."}</p>
            <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
              {[["Email", credentials.email], ["Password", credentials.password], ["Mobile PIN", credentials.pin]].map(([label, value]) => <div key={label} className="demo-credential-row" style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-overlay)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>{label}</span><strong>{value}</strong></div>)}
            </div>
            <div className="demo-success-actions"><Link href={credentials.managementLoginUrl} className="btn btn-primary">Open management portal →</Link><Link href={credentials.playStoreUrl} className="btn btn-outline">Get mobile app →</Link></div>
          </div>
        ) : (
          <form onSubmit={submit} className="portal-card" style={{ marginTop: 32, padding: 28, display: "grid", gap: 16 }}>
            <div className="demo-form-grid">
              <label><span className="section-kicker">First name</span><input name="firstName" required className="site-input" /></label>
              <label><span className="section-kicker">Last name</span><input name="lastName" required className="site-input" /></label>
            </div>
            <label><span className="section-kicker">Email address</span><input name="email" type="email" required className="site-input" /></label>
            <label><span className="section-kicker">Role to explore</span><select name="roleName" defaultValue="GENERAL_MANAGER" className="site-input">{roles.map(([value, label, description]) => <option key={value} value={value}>{label} — {description}</option>)}</select></label>
            <input name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} />
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}><input name="consent" type="checkbox" required /> I understand this is a temporary test account and access expires after 24 hours.</label>
            {error && <p style={{ color: "#fb7185", fontSize: 13 }}>{error}</p>}
            <button type="submit" disabled={status === "working"} className="btn btn-primary">{status === "working" ? "Preparing your sandbox…" : "Create demo access →"}</button>
          </form>
        )}
      </section>
      <PublicFooter />
    </main>
  );
}

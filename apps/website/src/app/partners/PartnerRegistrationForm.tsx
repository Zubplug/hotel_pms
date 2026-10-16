"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function PartnerRegistrationForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/partner/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessName: form.get("businessName"), directorName: form.get("directorName"), email: form.get("email"), phone: form.get("phone"), password: form.get("password"), terms: form.get("terms") === "on" }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Unable to create partner account"); setBusy(false); return; }
    window.location.href = data.redirectTo || "/partner/dashboard";
  }
  return <form onSubmit={submit} className="portal-card" style={{ display: "grid", gap: 14, maxWidth: 520 }}>
    <label className="form-group"><span className="form-label">Business or company name</span><input className="form-input" name="businessName" required minLength={2} autoComplete="organization" /></label>
    <label className="form-group"><span className="form-label">Director or representative name</span><input className="form-input" name="directorName" required minLength={2} autoComplete="name" /></label>
    <label className="form-group"><span className="form-label">Email</span><input className="form-input" name="email" required type="email" autoComplete="email" /></label>
    <label className="form-group"><span className="form-label">Phone (optional)</span><input className="form-input" name="phone" type="tel" /></label>
    <label className="form-group"><span className="form-label">Password</span><input className="form-input" name="password" required minLength={12} type="password" autoComplete="new-password" /><small style={{ color: "var(--text-muted)" }}>Use at least 12 characters.</small></label>
    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--text-muted)", fontSize: 12 }}><input name="terms" type="checkbox" required style={{ marginTop: 3 }} />I agree to the LodgeCore Reach partner terms and understand that commissions are earned only on qualifying fulfilled bookings.</label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? "Creating account…" : "Become a partner →"}</button>
    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>Already a partner? <Link href="/partner/login" style={{ color: "var(--accent)" }}>Sign in →</Link></p>
  </form>;
}

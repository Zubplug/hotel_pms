"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function PartnerLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/partner/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Invalid partner credentials"); setBusy(false); return; }
    window.location.href = data.redirectTo || "/partner/dashboard";
  }
  return <main className="site-shell" style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24 }}><form onSubmit={submit} className="portal-card" style={{ width: "100%", maxWidth: 440, display: "grid", gap: 16 }}><Link href="/" className="brand">Lodge<span className="brand-core">Core</span></Link><div><div className="section-kicker">LodgeCore Reach</div><h1 style={{ margin: "8px 0" }}>Partner sign in</h1><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Access your eligible property catalogue and referral tools.</p></div><label className="form-group"><span className="form-label">Email</span><input className="form-input" name="email" type="email" required autoComplete="email" /></label><label className="form-group"><span className="form-label">Password</span><input className="form-input" name="password" type="password" required autoComplete="current-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</button><p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>New partner? <Link href="/partners" style={{ color: "var(--accent)" }}>Create an account →</Link></p></form></main>;
}

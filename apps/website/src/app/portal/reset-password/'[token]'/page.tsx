"use client";

import Link from "next/link";
import { FormEvent, use, useState } from "react";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(null);
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) { setError("The passwords do not match."); setLoading(false); return; }
    const response = await fetch("/api/portal/reset-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: form.get("password") }) });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(data.error || "Unable to update your password."); return; }
    setDone(true);
  }

  return <main className="site-shell" style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}><div style={{ width: "100%", maxWidth: 440, padding: "44px 40px", border: "1px solid var(--border-card)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", boxShadow: "var(--shadow-lg)" }}><Link href="/" className="brand">Lodge<span className="brand-core">Core</span></Link><div className="section-kicker" style={{ marginTop: 40, marginBottom: 10 }}>Customer portal</div><h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, letterSpacing: "-.05em", marginBottom: 10 }}>{done ? "Password updated." : "Choose a new password."}</h1>{done ? <><p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7 }}>Your password has been updated successfully.</p><Link href="/portal/login" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 24 }}>Continue to sign in →</Link></> : <form onSubmit={submit} style={{ display: "grid", gap: 16 }}><p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>Use at least 12 characters.</p><div className="form-group"><label htmlFor="new-password" className="form-label">New password</label><input id="new-password" required minLength={12} type="password" name="password" autoComplete="new-password" className="form-input" /></div><div className="form-group"><label htmlFor="confirm-password" className="form-label">Confirm new password</label><input id="confirm-password" required minLength={12} type="password" name="confirmPassword" autoComplete="new-password" className="form-input" /></div>{error && <div className="form-error">{error}</div>}<button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", border: "none" }}>{loading ? "Updating…" : "Update password →"}</button></form>}</div></main>;
}

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    await fetch("/api/portal/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email") }) });
    setLoading(false);
    setSent(true);
  }

  return <main className="site-shell" style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}><div style={{ width: "100%", maxWidth: 440, padding: "44px 40px", border: "1px solid var(--border-card)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", boxShadow: "var(--shadow-lg)" }}><Link href="/" className="brand">Lodge<span className="brand-core">Core</span></Link><div className="section-kicker" style={{ marginTop: 40, marginBottom: 10 }}>Customer portal</div><h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, letterSpacing: "-.05em", marginBottom: 10 }}>Reset your password.</h1>{sent ? <><p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7 }}>If an account exists for that email, we’ve sent a secure reset link. Check your inbox and spam folder.</p><Link href="/portal/login" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 24 }}>Back to sign in →</Link></> : <><p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>Enter your user or staff email and we’ll send a link to update your password.</p><form onSubmit={submit} style={{ display: "grid", gap: 16 }}><div className="form-group"><label htmlFor="reset-email" className="form-label">Email address</label><input id="reset-email" required type="email" name="email" autoComplete="email" className="form-input" placeholder="you@yourproperty.com" /></div><button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", border: "none" }}>{loading ? "Sending…" : "Send reset link →"}</button></form><Link href="/portal/login" style={{ display: "block", marginTop: 24, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>← Back to sign in</Link></>}</div></main>;
}

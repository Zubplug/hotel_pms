"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function PartnerLoginPage() {
  const [error, setError]   = useState<string | null>(null);
  const [busy,  setBusy]    = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/partner/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error || "Invalid partner credentials. Please try again.");
      setBusy(false);
      return;
    }

    window.location.href = data.redirectTo || "/partner/dashboard";
  }

  return (
    <>
      <style>{`
        .reach-login-root {
          min-height: 100svh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #080B16;
          font-family: var(--font-inter, "Inter"), system-ui, sans-serif;
        }
        /* Left — branding panel */
        .reach-login-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 56px;
          background: linear-gradient(160deg, #0b1225 0%, #0f1735 60%, rgba(99,133,255,0.08) 100%);
          border-right: 1px solid rgba(255,255,255,0.07);
          overflow: hidden;
        }
        /* Decorative orbs */
        .reach-login-panel::before {
          content: "";
          position: absolute;
          top: -120px; right: -80px;
          width: 420px; height: 420px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,133,255,0.14), transparent 70%);
          pointer-events: none;
        }
        .reach-login-panel::after {
          content: "";
          position: absolute;
          bottom: -60px; left: -80px;
          width: 300px; height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16,185,129,0.08), transparent 70%);
          pointer-events: none;
        }
        .reach-login-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          position: relative;
          z-index: 1;
        }
        .reach-login-brand-mark {
          display: grid;
          place-items: center;
          width: 38px; height: 38px;
          border-radius: 11px;
          background: linear-gradient(135deg, #6385FF, #5146A8);
          box-shadow: 0 4px 16px rgba(99,133,255,0.35);
          color: #fff;
          font-family: var(--font-sora, "Sora"), system-ui, sans-serif;
          font-size: 20px;
          font-weight: 800;
        }
        .reach-login-brand-text {
          color: #F4F6FC;
          font-family: var(--font-sora, "Sora"), system-ui, sans-serif;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.05em;
        }
        .reach-login-brand-text span { color: #8BA4FF; }
        .reach-login-hero {
          position: relative;
          z-index: 1;
        }
        .reach-login-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px 5px 8px;
          border: 1px solid rgba(99,133,255,0.28);
          border-radius: 999px;
          background: rgba(99,133,255,0.1);
          color: #8BA4FF;
          font-family: var(--font-mono, "JetBrains Mono"), monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .reach-login-kicker-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #34D399;
          box-shadow: 0 0 8px rgba(16,185,129,0.6);
          animation: reach-login-ping 2.5s ease-out infinite;
        }
        @keyframes reach-login-ping {
          0%    { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70%   { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100%  { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        .reach-login-headline {
          color: #F4F6FC;
          font-family: var(--font-sora, "Sora"), system-ui, sans-serif;
          font-size: clamp(28px, 3vw, 42px);
          font-weight: 800;
          letter-spacing: -0.06em;
          line-height: 1;
          margin-bottom: 18px;
        }
        .reach-login-headline em {
          display: block;
          background: linear-gradient(135deg, #8BA4FF, #A78BFA);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-style: normal;
        }
        .reach-login-sub {
          color: #A4AEC3;
          font-size: 14px;
          line-height: 1.7;
          max-width: 380px;
        }
        /* Stat cards */
        .reach-login-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 36px;
          position: relative;
          z-index: 1;
        }
        .reach-login-stat {
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          background: rgba(255,255,255,0.025);
        }
        .reach-login-stat strong {
          display: block;
          color: #F4F6FC;
          font-family: var(--font-sora, "Sora"), system-ui, sans-serif;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.05em;
        }
        .reach-login-stat span {
          display: block;
          margin-top: 4px;
          color: #A4AEC3;
          font-size: 10px;
          line-height: 1.4;
        }
        .reach-login-footer {
          color: #7D89A3;
          font-size: 11px;
          position: relative;
          z-index: 1;
        }

        /* Right — form panel */
        .reach-login-form-side {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
        }
        .reach-login-form-wrap {
          width: 100%;
          max-width: 420px;
        }
        .reach-login-form-head { margin-bottom: 32px; }
        .reach-login-form-eyebrow {
          display: block;
          color: #6385FF;
          font-family: var(--font-mono, "JetBrains Mono"), monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .reach-login-form-head h1 {
          color: #F4F6FC;
          font-family: var(--font-sora, "Sora"), system-ui, sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.055em;
          line-height: 1;
          margin: 0 0 8px;
        }
        .reach-login-form-head p {
          color: #A4AEC3;
          font-size: 13px;
          line-height: 1.6;
        }
        .reach-login-field {
          display: grid;
          gap: 7px;
          margin-bottom: 16px;
        }
        .reach-login-field label {
          color: #A4AEC3;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .reach-login-field input {
          display: block;
          width: 100%;
          height: 46px;
          padding: 0 14px;
          border: 1px solid #27324A;
          border-radius: 10px;
          background: #172138;
          color: #F4F6FC;
          font: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .reach-login-field input::placeholder { color: #7D89A3; }
        .reach-login-field input:focus {
          border-color: #6385FF;
          box-shadow: 0 0 0 3px rgba(99,133,255,0.15);
          background: rgba(99,133,255,0.04);
        }
        .reach-login-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px 15px;
          border: 1px solid rgba(244,63,94,0.22);
          border-radius: 10px;
          background: rgba(244,63,94,0.06);
          color: #F87171;
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .reach-login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          height: 48px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6385FF, #5146A8);
          border: 1px solid rgba(99,133,255,0.3);
          color: #fff;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(99,133,255,0.25);
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          margin-top: 4px;
        }
        .reach-login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(99,133,255,0.38);
        }
        .reach-login-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .reach-login-spin {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: reach-login-spin 0.7s linear infinite;
        }
        @keyframes reach-login-spin { to { transform: rotate(360deg); } }
        .reach-login-links {
          margin-top: 22px;
          text-align: center;
          color: #A4AEC3;
          font-size: 12px;
        }
        .reach-login-links a {
          color: #8BA4FF;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.2s;
        }
        .reach-login-links a:hover { color: #6385FF; }
        .reach-login-divider {
          position: relative;
          margin: 24px 0;
          text-align: center;
        }
        .reach-login-divider::before {
          content: "";
          position: absolute;
          top: 50%; left: 0; right: 0;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }
        .reach-login-divider span {
          position: relative;
          padding: 0 12px;
          background: #080B16;
          color: #7D89A3;
          font-size: 10px;
          font-family: var(--font-mono, "JetBrains Mono"), monospace;
          letter-spacing: 0.1em;
        }

        @media (max-width: 900px) {
          .reach-login-root { grid-template-columns: 1fr; }
          .reach-login-panel { display: none; }
          .reach-login-form-side { padding: 40px 20px; }
        }
      `}</style>

      <div className="reach-login-root">
        {/* ── Left branding panel ── */}
        <div className="reach-login-panel">
          {/* Brand */}
          <Link href="/" className="reach-login-brand">
            <span className="reach-login-brand-mark">L</span>
            <span className="reach-login-brand-text">Lodge<span>Core</span></span>
          </Link>

          {/* Hero copy */}
          <div className="reach-login-hero">
            <div className="reach-login-kicker">
              <span className="reach-login-kicker-dot" />
              Reach Partner Network
            </div>
            <h2 className="reach-login-headline">
              Your hospitality<br />
              <em>referral hub.</em>
            </h2>
            <p className="reach-login-sub">
              Discover verified hotels, generate trackable referral links, and earn commissions on every fulfilled stay — all in one professional workspace.
            </p>

            {/* Stats */}
            <div className="reach-login-stats">
              <div className="reach-login-stat">
                <strong>₦0 fee</strong>
                <span>Free to join and start earning</span>
              </div>
              <div className="reach-login-stat">
                <strong>Real-time</strong>
                <span>Live booking & commission tracking</span>
              </div>
              <div className="reach-login-stat">
                <strong>Secure</strong>
                <span>Verified payouts to your wallet</span>
              </div>
            </div>
          </div>

          <p className="reach-login-footer">
            © {new Date().getFullYear()} LodgeCore Technologies. All rights reserved.
          </p>
        </div>

        {/* ── Right form panel ── */}
        <div className="reach-login-form-side">
          <div className="reach-login-form-wrap">
            <div className="reach-login-form-head">
              <span className="reach-login-form-eyebrow">LodgeCore Reach</span>
              <h1>Partner sign in</h1>
              <p>Access your property catalogue and referral tools.</p>
            </div>

            {error && (
              <div className="reach-login-error" role="alert">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} noValidate>
              <div className="reach-login-field">
                <label htmlFor="partner-email">Email address</label>
                <input
                  id="partner-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="reach-login-field">
                <label htmlFor="partner-password">Password</label>
                <input
                  id="partner-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button className="reach-login-btn" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <span className="reach-login-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in to Reach →"
                )}
              </button>
            </form>

            <div className="reach-login-divider">
              <span>or</span>
            </div>

            <div className="reach-login-links">
              New to Reach?{" "}
              <Link href="/partners">Become a partner →</Link>
            </div>

            <div className="reach-login-links" style={{ marginTop: 10 }}>
              <Link href="/">← Back to LodgeCore</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

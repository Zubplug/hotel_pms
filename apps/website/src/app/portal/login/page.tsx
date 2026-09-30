"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function PortalLogin() {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
      callbackUrl: "/portal/dashboard",
    });
    setLoading(false);
    if (!result?.ok) setError(true);
    else window.location.href = result.url || "/portal/dashboard";
  }

  return (
    <main
      className="site-shell"
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 18px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 700,
          height: 500,
          top: "40%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse, rgba(0,212,232,.09), transparent 65%)",
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          padding: "44px 40px",
          border: "1px solid var(--border-card)",
          borderRadius: "var(--radius-xl)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="brand"
          style={{ display: "inline-block", marginBottom: 40 }}
        >
          Lodge<span className="brand-core">Core</span>
        </Link>

        <div
          className="section-kicker"
          style={{ marginBottom: 10 }}
        >
          Customer portal
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
            fontWeight: 800,
            letterSpacing: "-.05em",
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Sign in to your<br />workspace.
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          Access your subscriptions, implementation status and support workspace.
        </p>

        <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Work email</label>
            <input
              id="login-email"
              required
              type="email"
              name="email"
              autoComplete="email"
              className="form-input"
              placeholder="you@yourproperty.com"
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="login-password" className="form-label">Password</label>
            <input
              id="login-password"
              required
              type="password"
              name="password"
              autoComplete="current-password"
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="form-error">
              Invalid credentials — check your email and password and try again.
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", border: "none", marginTop: 4 }}
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/book-demo"
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              transition: "color .2s",
            }}
          >
            Not a customer? Book a demo →
          </Link>
          <Link
            href="/"
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            ← Back
          </Link>
        </div>
      </div>
    </main>
  );
}

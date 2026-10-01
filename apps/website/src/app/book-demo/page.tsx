"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

const TEAMS = [
  { id: "hospitality", icon: "🏨", name: "LodgeCore Hospitality",  desc: "PMS, POS, booking engine, accounting and operations software." },
  { id: "access",      icon: "🔑", name: "LodgeCore Access",       desc: "Electronic locks, RFID, smart locks and access control hardware." },
  { id: "smart",       icon: "⚡", name: "LodgeCore Smart",        desc: "Smart rooms, home automation, energy management and building technology." },
  { id: "systems",     icon: "🔧", name: "LodgeCore Systems",      desc: "Installation, integration and full property technology deployment." },
  { id: "care",        icon: "🛡️", name: "LodgeCore Care",         desc: "Maintenance, monitoring, support and managed services." },
] as const;

const PROPERTY_TYPES = [
  "Hotel", "Resort", "Lodge", "Guest House", "Serviced Apartment",
  "Short-Let Property", "Residential Home", "Office", "Commercial Building",
  "Estate / Development", "Hostel", "Other",
];

export default function BookDemoPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = event.currentTarget;
    const values = new FormData(form);
    const firstName = String(values.get("firstName") || "").trim();
    const lastName = String(values.get("lastName") || "").trim();
    const interests = values.getAll("interest").map(String);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          email: values.get("email"),
          phone: values.get("phone"),
          company: values.get("propertyName"),
          propertyName: values.get("propertyName"),
          propertyType: values.get("propertyType"),
          roomCount: values.get("roomCount"),
          message: values.get("message"),
          interests,
          source: "BOOK_DEMO",
          consent: "true",
        }),
      });
      setStatus(response.ok ? "sent" : "error");
      if (response.ok) form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="site-shell">
      <PublicHeader />

      <section style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div className="contain" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
          {/* Left: pitch */}
          <div>
            <div className="section-kicker">Get in Touch</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.2rem,4vw,3.4rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 20 }}>
              Let&apos;s talk about<br />your property.
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.75, color: "var(--text-secondary)", marginBottom: 32 }}>
              Tell us what you need and we&apos;ll connect you with the right LodgeCore team — whether that&apos;s hospitality software, electronic locks, smart technology, or a full property deployment.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {TEAMS.map((t) => (
                <div key={t.id} style={{
                  display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px",
                  border: "1px solid var(--border-card)", borderRadius: "var(--radius-md)", background: "var(--bg-card)",
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.02em", marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55 }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div className="portal-card" style={{ padding: "36px 32px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.04em", marginBottom: 6 }}>
              Request a Demo or Quote
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 28, lineHeight: 1.6 }}>
              We&apos;ll get back to you within one business day.
            </p>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>First name</label>
                  <input name="firstName" required type="text" placeholder="Jane" style={{
                    width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                    fontSize: 13, outline: "none", boxSizing: "border-box",
                  }} />
                </div>
                <div>
                  <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Last name</label>
                  <input name="lastName" required type="text" placeholder="Doe" style={{
                    width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                    fontSize: 13, outline: "none", boxSizing: "border-box",
                  }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Work email</label>
                <input name="email" required type="email" placeholder="jane@yourhotel.com" style={{
                  width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                  fontSize: 13, outline: "none", boxSizing: "border-box",
                }} />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Phone number</label>
                <input name="phone" type="tel" placeholder="+234 800 000 0000" style={{
                  width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                  fontSize: 13, outline: "none", boxSizing: "border-box",
                }} />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Property name</label>
                <input name="propertyName" type="text" placeholder="Your property name" style={{
                  width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                  fontSize: 13, outline: "none", boxSizing: "border-box",
                }} />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Property type</label>
                <select name="propertyType" style={{
                  width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                  fontSize: 13, outline: "none", boxSizing: "border-box",
                }}>
                  <option value="">Select property type…</option>
                  {PROPERTY_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Number of rooms</label>
                <input name="roomCount" type="number" min="0" max="100000" placeholder="e.g.  forty" style={{
                  width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                  fontSize: 13, outline: "none", boxSizing: "border-box",
                }} />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>What are you interested in?</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TEAMS.map((t) => (
                    <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
                      <input type="checkbox" name="interest" value={t.id} style={{ accentColor: "var(--accent)" }} />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Tell us about your property</label>
                <textarea name="message" rows={4} placeholder="Property name, number of rooms, current technology, what you're looking to improve…" style={{
                  width: "100%", background: "var(--bg-overlay)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", padding: "10px 12px", color: "var(--text-primary)",
                  fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
                }} />
              </div>

              <button disabled={status === "sending"} type="submit" className="btn btn-primary" style={{ width: "100%", border: "none", padding: "14px", fontSize: 14, fontWeight: 700, cursor: status === "sending" ? "wait" : "pointer", opacity: status === "sending" ? .65 : 1 }}>
                {status === "sending" ? "Sending request…" : "Send request →"}
              </button>

              {status === "error" && <p role="alert" style={{ fontSize: 12, color: "#ff7b8e", textAlign: "center" }}>We could not submit your request. Please try again.</p>}

              <p style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
                By submitting, you agree to LodgeCore&apos;s{" "}
                <Link href="/privacy" style={{ color: "var(--accent)" }}>privacy policy</Link>.
                We&apos;ll never share your data.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* SUCCESS MODAL */}
      {status === "sent" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0a1120] p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* Ambient glow behind icon */}
            <div className="absolute left-1/2 top-10 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />
            
            <div className="relative flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="mb-2 font-display text-2xl font-bold tracking-tight text-white">
                Request Received
              </h3>
              
              <p className="mb-8 text-sm leading-relaxed text-slate-400">
                Thank you for your interest in LodgeCore. A member of our team will review your property details and contact you within one business day.
              </p>
              
              <Link 
                href="/"
                className="flex w-full items-center justify-center rounded-lg bg-white py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200"
              >
                Return to homepage
              </Link>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </main>
  );
}

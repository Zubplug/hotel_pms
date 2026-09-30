import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Integrations — Connect LodgeCore to Your Tech Stack",
  description: "LodgeCore integrates with payment gateways, OTA channels, accounting software, booking platforms, smart devices and more.",
};

const CATEGORIES = [
  {
    name: "Payments",
    icon: "💳",
    integrations: [
      { name: "Stripe",          desc: "Online payments and card processing." },
      { name: "Flutterwave",     desc: "African payment gateway integration." },
      { name: "Paystack",        desc: "Nigerian and Ghana payment processing." },
      { name: "Square",          desc: "POS and card payment terminals." },
    ],
  },
  {
    name: "OTA & Booking",
    icon: "📅",
    integrations: [
      { name: "Booking.com",     desc: "Real-time availability and reservation sync." },
      { name: "Expedia",         desc: "OTA channel management and rate sync." },
      { name: "Airbnb",          desc: "Availability and booking synchronisation." },
      { name: "Hotels.ng",       desc: "Local OTA channel integration." },
    ],
  },
  {
    name: "Access & Smart",
    icon: "🔑",
    integrations: [
      { name: "RFID Lock Systems",   desc: "PMS-driven key card issuance and revocation." },
      { name: "Smart Room Systems",  desc: "Check-in triggered room activation." },
      { name: "Building Management", desc: "BMS integration for energy and climate." },
      { name: "Intercom Systems",    desc: "Visitor access and intercom connectivity." },
    ],
  },
  {
    name: "Accounting",
    icon: "📊",
    integrations: [
      { name: "QuickBooks",  desc: "Financial data sync and journal exports." },
      { name: "Sage",        desc: "Accounting system integration." },
      { name: "Xero",        desc: "Cloud accounting integration." },
      { name: "TALLY",       desc: "Local accounting software integration." },
    ],
  },
  {
    name: "Communication",
    icon: "📱",
    integrations: [
      { name: "WhatsApp Business", desc: "Guest messaging and pre-arrival communication." },
      { name: "Email (SMTP)",       desc: "Confirmation, invoice and notification emails." },
      { name: "SMS Gateways",       desc: "Local and international SMS notification providers." },
    ],
  },
  {
    name: "APIs & Custom",
    icon: "🔗",
    integrations: [
      { name: "REST API",     desc: "Full LodgeCore REST API for custom integrations." },
      { name: "Webhooks",     desc: "Event-driven webhooks for real-time data push." },
      { name: "Custom Middleware", desc: "Bespoke integration development by LodgeCore Systems." },
    ],
  },
] as const;

export default function IntegrationsPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      <section style={{ paddingTop: 140, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(0,212,232,.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div className="contain">
          <div className="section-kicker">Integrations</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem,5vw,4rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24, maxWidth: 680 }}>
            LodgeCore Connects to<br />Your Entire Tech Stack.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 540, marginBottom: 36 }}>
            Payments, OTAs, accounting, access control, smart systems and custom APIs — LodgeCore integrates with the tools you already use, and the hardware you need.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/book-demo" className="btn btn-primary">Discuss your integration →</Link>
            <Link href="/services/integration" className="btn btn-outline">Integration services</Link>
          </div>
        </div>
      </section>

      <section className="section-gap">
        <div className="contain">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 22 }}>{cat.icon}</span>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-.04em" }}>{cat.name}</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                {cat.integrations.map((intg) => (
                  <div key={intg.name} className="portal-card" style={{ padding: "16px 18px" }}>
                    <div className="portal-area-name" style={{ marginBottom: 4 }}>{intg.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.55 }}>{intg.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-gap" style={{ background: "var(--bg-raised)" }}>
        <div className="contain" style={{ textAlign: "center" }}>
          <div className="section-kicker">Custom Integration</div>
          <h2 className="section-title">Need Something Not Listed?</h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 540, margin: "0 auto 32px", lineHeight: 1.7 }}>
            LodgeCore Systems builds custom integrations for specific hardware, software and third-party platforms. Talk to us about your requirements.
          </p>
          <Link href="/book-demo" className="btn btn-primary btn-lg">Request a custom integration →</Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

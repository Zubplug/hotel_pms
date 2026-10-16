import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { PartnerRegistrationForm } from "./PartnerRegistrationForm";

export default function PartnersPage() {
  return <PublicShell eyebrow="LodgeCore Reach" title="Turn trusted recommendations into revenue." description="Join the LodgeCore Reach partner network and promote eligible properties with trackable referral tools, room information and transparent commission reporting.">
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, .9fr)", gap: 28, alignItems: "start" }}>
      <div className="portal-card" style={{ display: "grid", gap: 18 }}>
        {[["Discover", "Browse active LodgeCore properties and their public room offerings."], ["Share", "Create property campaigns and copy ready-to-use referral links or banner snippets."], ["Earn", "See attributed bookings, fulfilled stays and approved commissions in one partner dashboard."]].map(([title, text]) => <div key={title} style={{ display: "flex", gap: 14 }}><span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>0{["Discover", "Share", "Earn"].indexOf(title) + 1}</span><div><h3 style={{ margin: 0, color: "var(--text-primary)" }}>{title}</h3><p style={{ margin: "5px 0 0", color: "var(--text-muted)", lineHeight: 1.6 }}>{text}</p></div></div>)}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, color: "var(--text-muted)", fontSize: 12 }}>Only properties with an active LodgeCore subscription and active Reach add-on are published to partners. Property owners control availability and campaigns.</div>
        <Link href="/partner/login" className="btn btn-outline" style={{ width: "fit-content" }}>Partner sign in →</Link>
      </div>
      <PartnerRegistrationForm />
    </div>
  </PublicShell>;
}

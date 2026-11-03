import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-shell";
import { DeleteRequestForm } from "./DeleteRequestForm";

export const metadata: Metadata = {
  title: "Request account deletion",
  description: "Request deletion of your LodgeCore Management account and associated personal data.",
  alternates: { canonical: "https://getlodgecore.vercel.app/privacy/delete" },
  robots: { index: true, follow: true },
};

export default function DeleteAccountPage() {
  return <main className="site-shell"><PublicHeader /><section className="page-hero" style={{ paddingTop: 132, paddingBottom: 64 }}><div className="page-hero-bg" /><div className="contain"><div className="section-kicker">LodgeCore Management · Data control</div><h1>Request account deletion.</h1><p style={{ maxWidth: 650 }}>Submit a controlled request using the email address or phone number registered to your account. Your account and data are not deleted automatically.</p></div></section><section className="section-gap"><div className="contain"><article style={{ maxWidth: 760, padding: "34px 30px", border: "1px solid var(--border-card)", borderRadius: "var(--radius-xl)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8 }}><div style={{ padding: "18px 20px", border: "1px solid rgba(0,212,232,.25)", borderRadius: 14, background: "rgba(0,212,232,.06)", marginBottom: 28 }}><h2 style={{ color: "var(--text-primary)", fontSize: 20, margin: "0 0 8px" }}>Submit for manager review</h2><p style={{ margin: 0 }}>We use your registered email or phone number to locate your active account and property access. The property manager must review and approve the request before any separate deletion process can begin.</p></div><DeleteRequestForm /><h2 style={{ color: "var(--text-primary)", fontSize: 20, margin: "34px 0 10px" }}>What happens after submission?</h2><p>Your request is recorded as pending and routed to authorised managers for every active property linked to the matched staff account. LodgeCore does not delete your account, guest records, financial records, operational records, or audit history when this form is submitted.</p><p>After review, the property manager may approve or reject the request. If approved, LodgeCore will confirm the deletion scope with the appropriate administrator and process eligible personal data separately. Records may be retained for security, fraud prevention, legal, tax, accounting, contractual, or property-audit obligations.</p><div style={{ borderTop: "1px solid var(--border)", marginTop: 30, paddingTop: 20, display: "flex", gap: 18, flexWrap: "wrap" }}><Link href="/privacy" style={{ color: "var(--accent)" }}>Read the full privacy policy →</Link><Link href="/" style={{ color: "var(--accent)" }}>Back to LodgeCore →</Link></div></article></div></section><PublicFooter /></main>;
}

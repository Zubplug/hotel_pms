"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type PartnerIdentity = {
  displayName: string;
  firstName?: string | null;
  businessName?: string | null;
  verificationStatus: string;
};

const sections = [
  { label: "Overview", items: [{ href: "/partner/dashboard", label: "Dashboard", icon: "⌂" }] },
  { label: "Discover", items: [{ href: "/partner/properties", label: "Explore properties", icon: "⌖" }, { href: "/partner/rooms", label: "Room types & offers", icon: "▣" }, { href: "/partner/events", label: "Events & venues", icon: "◇" }] },
  { label: "Marketing studio", items: [{ href: "/partner/links", label: "My referral links", icon: "↗" }, { href: "/partner/campaigns", label: "Campaigns", icon: "✦" }, { href: "/partner/marketing", label: "Banners & creatives", icon: "▧" }, { href: "/partner/templates", label: "Marketing templates", icon: "✎" }] },
  { label: "Performance", items: [{ href: "/partner/bookings", label: "Referred bookings", icon: "◷" }, { href: "/partner/analytics", label: "Analytics", icon: "⌁" }] },
  { label: "Earnings", items: [{ href: "/partner/earnings", label: "Commission earnings", icon: "₦" }, { href: "/partner/wallet", label: "Wallet & payouts", icon: "◉" }, { href: "/partner/transactions", label: "Transaction history", icon: "≡" }] },
  { label: "Account", items: [{ href: "/partner/profile", label: "Partner profile", icon: "○" }, { href: "/partner/settings/payouts", label: "Payout settings", icon: "⚙" }, { href: "/partner/support", label: "Help & support", icon: "?" }] },
];

function initials(identity: PartnerIdentity) {
  const source = identity.businessName || identity.displayName || "Reach";
  return source.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function PartnerShell({ children, partner, availableBalance, currency = "NGN" }: { children: React.ReactNode; partner: PartnerIdentity; availableBalance?: number; currency?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const verified = partner.verificationStatus === "VERIFIED";
  const displayName = partner.firstName || partner.businessName || partner.displayName;
  async function logout() {
    await fetch("/api/partner/logout", { method: "POST" });
    window.location.href = "/partner/login";
  }
  return <div className="reach-app-shell">
    <aside className={`reach-sidebar${open ? " is-open" : ""}`} aria-label="Reach partner navigation">
      <div className="reach-brand"><Link href="/partner/dashboard" onClick={() => setOpen(false)}><span className="reach-brand-mark">L</span><span>Lodge<strong>Core</strong><small>REACH NETWORK</small></span></Link><button className="reach-close" onClick={() => setOpen(false)} aria-label="Close navigation">×</button></div>
      <div className="reach-partner-card"><div className="reach-avatar">{initials(partner)}</div><div className="reach-partner-copy"><strong>{partner.businessName || partner.displayName}</strong><span>{verified ? "Verified partner" : "Profile under review"}</span></div><span className={`reach-status-dot ${verified ? "is-verified" : ""}`} /></div>
      <nav className="reach-nav">{sections.map((section) => <div className="reach-nav-group" key={section.label}><p>{section.label}</p>{section.items.map((item) => { const active = pathname === item.href || (item.href !== "/partner/dashboard" && pathname.startsWith(`${item.href}/`)); return <Link key={item.href} href={item.href} className={`reach-nav-item${active ? " is-active" : ""}`} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}><span className="reach-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></Link>; })}</div>)}</nav>
      <div className="reach-sidebar-bottom"><div className="reach-balance-mini"><span>Available balance</span><strong>{new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(availableBalance || 0)}</strong></div><button className="reach-logout" onClick={() => void logout()}>Sign out <span>→</span></button></div>
    </aside>
    {open && <button className="reach-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="reach-main"><header className="reach-topbar"><button className="reach-menu" onClick={() => setOpen(true)} aria-label="Open navigation">☰</button><div><span className="reach-breadcrumb">LodgeCore Reach</span><span className="reach-breadcrumb-sep">/</span><span className="reach-breadcrumb-current">{sections.flatMap((section) => section.items).find((item) => pathname === item.href || (item.href !== "/partner/dashboard" && pathname.startsWith(`${item.href}/`)))?.label || "Partner workspace"}</span></div><div className="reach-topbar-actions"><Link href="/partner/support" className="reach-help-link">Need help?</Link><div className="reach-top-avatar">{initials(partner)}</div></div></header><main className="reach-content">{children}</main></div>
  </div>;
}

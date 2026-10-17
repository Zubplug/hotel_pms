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

/* ── Inline SVG Icons ──────────────────────────────────────── */
function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const icons = {
  dashboard:    "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  properties:   "M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z",
  rooms:        "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  events:       "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  links:        "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  campaigns:    "M22 12h-4l-3 9L9 3l-3 9H2",
  marketing:    "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7",
  templates:    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  bookings:     "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  analytics:    "M18 20V10 M12 20V4 M6 20v-6",
  earnings:     "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  wallet:       "M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4z",
  transactions: "M21 12H3 M21 6H3 M21 18H3",
  profile:      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  payouts:      "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  support:      "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01",
  logout:       "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  menu:         "M3 12h18 M3 6h18 M3 18h18",
  close:        "M18 6 6 18 M6 6l12 12",
  chevronRight: "M9 18l6-6-6-6",
};

/* ── Navigation structure ──────────────────────────────────── */
const sections = [
  {
    label: "Overview",
    items: [
      { href: "/partner/dashboard", label: "Dashboard", icon: "dashboard" },
    ],
  },
  {
    label: "Discover",
    items: [
      { href: "/partner/properties", label: "Explore properties", icon: "properties" },
      { href: "/partner/rooms",      label: "Room types & offers", icon: "rooms" },
      { href: "/partner/events",     label: "Events & venues",     icon: "events" },
    ],
  },
  {
    label: "Marketing studio",
    items: [
      { href: "/partner/links",      label: "My referral links",    icon: "links" },
      { href: "/partner/campaigns",  label: "Campaigns",            icon: "campaigns" },
      { href: "/partner/marketing",  label: "Banners & creatives",  icon: "marketing" },
      { href: "/partner/templates",  label: "Marketing templates",  icon: "templates" },
    ],
  },
  {
    label: "Performance",
    items: [
      { href: "/partner/bookings",   label: "Referred bookings", icon: "bookings" },
      { href: "/partner/analytics",  label: "Analytics",         icon: "analytics" },
    ],
  },
  {
    label: "Earnings",
    items: [
      { href: "/partner/earnings",     label: "Commission earnings", icon: "earnings" },
      { href: "/partner/wallet",       label: "Wallet & payouts",    icon: "wallet" },
      { href: "/partner/transactions", label: "Transaction history", icon: "transactions" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/partner/profile",          label: "Partner profile",  icon: "profile" },
      { href: "/partner/settings/payouts", label: "Payout settings",  icon: "payouts" },
      { href: "/partner/support",          label: "Help & support",   icon: "support" },
    ],
  },
];

/* ── Utility ───────────────────────────────────────────────── */
function initials(identity: PartnerIdentity) {
  const src = identity.businessName || identity.displayName || "Reach";
  return src.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function money(amount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ── PartnerShell ──────────────────────────────────────────── */
export function PartnerShell({
  children,
  partner,
  availableBalance,
  currency = "NGN",
}: {
  children: React.ReactNode;
  partner: PartnerIdentity;
  availableBalance?: number;
  currency?: string;
}) {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);
  const verified  = partner.verificationStatus === "VERIFIED";
  const displayName = partner.firstName || partner.businessName || partner.displayName;

  const activeLabel = sections
    .flatMap((s) => s.items)
    .find((item) => pathname === item.href || (item.href !== "/partner/dashboard" && pathname.startsWith(`${item.href}/`)))
    ?.label ?? "Partner workspace";

  async function logout() {
    await fetch("/api/partner/logout", { method: "POST" });
    window.location.href = "/partner/login";
  }

  return (
    <div className="reach-app-shell">
      {/* ── Sidebar ── */}
      <aside className={`reach-sidebar${open ? " is-open" : ""}`} aria-label="Reach partner navigation">
        {/* Brand */}
        <Link href="/partner/dashboard" className="reach-brand" onClick={() => setOpen(false)}>
          <span className="reach-brand-mark">L</span>
          <span className="reach-brand-copy">
            <strong>Lodge<span>Core</span></strong>
            <small>Reach Network</small>
          </span>
        </Link>

        {/* Mobile close */}
        <button className="reach-close" onClick={() => setOpen(false)} aria-label="Close navigation">
          <Icon d={icons.close} size={14} />
        </button>

        {/* Partner card */}
        <div className="reach-partner-card">
          <div className="reach-avatar" aria-hidden="true">{initials(partner)}</div>
          <div className="reach-partner-copy">
            <strong>{partner.businessName || partner.displayName}</strong>
            <span>{verified ? "Verified partner" : "Pending verification"}</span>
          </div>
          <span className={`reach-status-dot${verified ? " is-verified" : ""}`} aria-label={verified ? "Verified" : "Pending"} />
        </div>

        {/* Navigation */}
        <nav className="reach-nav" aria-label="Partner portal">
          {sections.map((section) => (
            <div className="reach-nav-group" key={section.label}>
              <p>{section.label}</p>
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/partner/dashboard" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`reach-nav-item${active ? " is-active" : ""}`}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="reach-nav-icon">
                      <Icon d={icons[item.icon as keyof typeof icons]} size={14} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar bottom: balance + logout */}
        <div className="reach-sidebar-bottom">
          <div className="reach-balance-mini">
            <span>Available balance</span>
            <strong>{money(availableBalance ?? 0, currency)}</strong>
          </div>
          <button className="reach-logout" onClick={() => void logout()} aria-label="Sign out">
            <span>Sign out</span>
            <Icon d={icons.logout} size={13} />
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <button
          className="reach-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Main ── */}
      <div className="reach-main">
        {/* Top bar */}
        <header className="reach-topbar">
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className="reach-menu"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Icon d={icons.menu} size={15} />
            </button>
            <nav className="reach-breadcrumb" aria-label="Breadcrumb">
              <span>LodgeCore Reach</span>
              <span className="reach-breadcrumb-sep">/</span>
              <span className="reach-breadcrumb-current">{activeLabel}</span>
            </nav>
          </div>

          <div className="reach-topbar-actions">
            <Link href="/partner/support" className="reach-help-link">Need help?</Link>
            <div className="reach-top-avatar" aria-hidden="true">{initials(partner)}</div>
          </div>
        </header>

        {/* Page content */}
        <main className="reach-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

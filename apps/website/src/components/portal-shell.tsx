"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/portal/dashboard",      icon: "◈",  label: "Overview",        badge: null },
  { href: "/portal/subscription",   icon: "⬡",  label: "Subscription",    badge: null },
  { href: "/portal/properties",     icon: "🏨", label: "Properties",      badge: null },
  { href: "/portal/implementation", icon: "🚀", label: "Implementation",  badge: null },
  { href: "/portal/hardware",       icon: "🔧", label: "Hardware",        badge: null },
  { href: "/portal/integrations",   icon: "⟳",  label: "Integrations",   badge: null },
  { href: "/portal/support",        icon: "◎",  label: "Support",         badge: null },
  { href: "/portal/billing",        icon: "◇",  label: "Billing",         badge: null },
  { href: "/portal/settings",       icon: "⚙",  label: "Settings",        badge: null },
];

export function PortalShell({
  children,
  orgName,
  userName,
}: {
  children: React.ReactNode;
  orgName?: string;
  userName?: string;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initials = (s?: string) =>
    (s || "LC").split(/[\s@]/)[0].slice(0, 2).toUpperCase();

  const currentLabel =
    NAV_ITEMS.find((n) => pathname.startsWith(n.href))?.label ?? "Portal";

  return (
    <div className="portal-shell">
      {/* ── SIDEBAR ────────────────────────────────────────── */}
      <aside
        className={`portal-sidebar${sidebarOpen ? " open" : ""}`}
        aria-label="Portal navigation"
      >
        {/* Brand */}
        <div className="portal-brand">
          <Link
            href="/portal/dashboard"
            className="ps-brand"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="ps-brand-logo">
              <span className="ps-brand-l">L</span>
              <span className="ps-brand-c">C</span>
            </span>
            <span className="ps-brand-text">
              Lodge<em>Core</em>
            </span>
          </Link>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg viewBox="0 0 14 14" fill="none" width="14">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Org badge */}
        {orgName && (
          <div className="ps-org">
            <div className="ps-org-avatar">{initials(orgName)}</div>
            <div className="ps-org-info">
              <span className="ps-org-name">{orgName}</span>
              <span className="ps-org-role">Customer workspace</span>
            </div>
            <div className="ps-org-status">
              <span className="ps-status-dot" />
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="ps-divider" />

        {/* Nav */}
        <nav className="portal-nav" aria-label="Portal sections">
          <div className="ps-nav-section-label">Workspace</div>
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`ps-nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="ps-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="ps-nav-label">{item.label}</span>
                {active && <span className="ps-nav-active-bar" />}
              </Link>
            );
          })}
        </nav>

        <div className="ps-divider" />

        {/* User footer */}
        <div className="ps-sidebar-footer">
          {userName && (
            <div className="ps-user">
              <div className="ps-user-avatar">{initials(userName)}</div>
              <div className="ps-user-info">
                <span className="ps-user-name">{userName}</span>
                <span className="ps-user-role">Portal user</span>
              </div>
            </div>
          )}
          <div className="ps-footer-links">
            <Link href="/" className="ps-footer-link">
              <svg viewBox="0 0 14 14" fill="none" width="11">
                <path d="M7 1H1v12h12V7M9 1h4m0 0v4m0-4L6 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to site
            </Link>
            <button
              className="ps-footer-link"
              onClick={() => signOut({ callbackUrl: "/portal/login" })}
            >
              <svg viewBox="0 0 14 14" fill="none" width="11">
                <path d="M5 2H2v10h3M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── BACKDROP (mobile) ──────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="portal-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── MAIN AREA ──────────────────────────────────────── */}
      <div className="portal-main">
        {/* Top bar */}
        <header className="ps-topbar">
          <div className="ps-topbar-left">
            <button
              className="portal-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
            >
              <span /><span /><span />
            </button>
            <div className="ps-topbar-breadcrumb">
              <Link href="/portal/dashboard" className="ps-topbar-brand">
                Lodge<em>Core</em>
              </Link>
              <span className="ps-topbar-sep" aria-hidden="true">/</span>
              <span className="ps-topbar-page">{currentLabel}</span>
            </div>
          </div>
          <div className="ps-topbar-right">
            <Link href="/portal/support" className="ps-topbar-icon-btn" title="Support">
              <svg viewBox="0 0 20 20" fill="none" width="16">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7.5 8a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M10 15v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>
            <Link href="/portal/settings" className="ps-topbar-icon-btn" title="Settings">
              <svg viewBox="0 0 20 20" fill="none" width="16">
                <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 3v1M10 16v1M3 10h1M16 10h1M5.22 5.22l.7.7M14.08 14.08l.7.7M5.22 14.78l.7-.7M14.08 5.92l.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Link>
            {userName && (
              <div className="ps-topbar-avatar" title={userName}>
                {initials(userName)}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}

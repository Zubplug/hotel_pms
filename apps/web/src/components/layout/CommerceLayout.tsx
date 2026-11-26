'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Store,
  UtensilsCrossed,
  ShoppingBag,
  BarChart3,
  Users,
  Tag,
  Truck,
  Code2,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const COMMERCE_NAV = [
  {
    section: 'Overview',
    items: [
      { name: 'Dashboard',   href: '/fnb/commerce',            icon: LayoutDashboard },
      { name: 'Live Orders', href: '/fnb/commerce/orders',      icon: ShoppingBag },
      { name: 'Analytics',   href: '/fnb/commerce/analytics',   icon: BarChart3 },
    ],
  },
  {
    section: 'Store',
    items: [
      { name: 'Store Setup', href: '/fnb/commerce/setup',       icon: Settings },
      { name: 'Menu Studio', href: '/fnb/commerce/menu',        icon: UtensilsCrossed },
      { name: 'Promotions',  href: '/fnb/commerce/promotions',  icon: Tag },
    ],
  },
  {
    section: 'Operations',
    items: [
      { name: 'Delivery & Zones', href: '/fnb/commerce/delivery',   icon: Truck },
      { name: 'Customers',        href: '/fnb/commerce/customers',   icon: Users },
      { name: 'Integrations',     href: '/fnb/commerce/integrations', icon: Code2 },
    ],
  },
];

export function CommerceLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const logout = useLogout();
  const { data: session } = useLodgeCoreSession();

  function isActive(href: string) {
    if (href === '/fnb/commerce') return pathname === '/fnb/commerce';
    return pathname.startsWith(href);
  }

  return (
    <div className="commerce-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="commerce-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={cn('commerce-sidebar', sidebarOpen && 'commerce-sidebar--open')}>
        {/* Logo */}
        <div className="commerce-sidebar__logo">
          <div className="commerce-sidebar__logo-icon">
            <Zap size={18} />
          </div>
          <div>
            <p className="commerce-sidebar__logo-title">Food Commerce</p>
            <p className="commerce-sidebar__logo-sub">
              {session?.user?.name ?? 'Loading…'}
            </p>
          </div>
          <button
            className="commerce-sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="commerce-sidebar__nav">
          {COMMERCE_NAV.map((group) => (
            <div key={group.section} className="commerce-sidebar__group">
              <p className="commerce-sidebar__section-label">{group.section}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn('commerce-nav-item', active && 'commerce-nav-item--active')}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={16} className="commerce-nav-item__icon" />
                    <span>{item.name}</span>
                    {active && <ChevronRight size={14} className="commerce-nav-item__chevron" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="commerce-sidebar__footer">
          <Link href="/fnb" className="commerce-nav-item commerce-nav-item--muted">
            <Store size={16} />
            <span>Back to F&amp;B</span>
          </Link>
          <button
            className="commerce-nav-item commerce-nav-item--muted"
            onClick={() => logout()}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="commerce-main">
        {/* Top bar (mobile) */}
        <header className="commerce-topbar">
          <button
            className="commerce-topbar__menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="commerce-topbar__logo">
            <Zap size={16} />
            <span>Food Commerce</span>
          </div>
        </header>

        <main className="commerce-content">
          {children}
        </main>
      </div>

      <style>{`
        .commerce-shell {
          display: flex;
          min-height: 100vh;
          background: hsl(220 20% 97%);
          font-family: var(--font-sans, 'Inter', system-ui, sans-serif);
        }

        /* ── Sidebar ──────────────────────────────────────────── */
        .commerce-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: hsl(222 47% 11%);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          z-index: 40;
          transition: transform 0.25s ease;
        }
        @media (max-width: 1023px) {
          .commerce-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            transform: translateX(-100%);
          }
          .commerce-sidebar--open {
            transform: translateX(0);
            box-shadow: 4px 0 24px rgba(0,0,0,0.3);
          }
          .commerce-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 39;
          }
        }

        .commerce-sidebar__logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 20px 16px 16px;
          border-bottom: 1px solid hsl(222 47% 18%);
        }
        .commerce-sidebar__logo-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: hsl(262 83% 58%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .commerce-sidebar__logo-title {
          font-size: 13px;
          font-weight: 600;
          color: hsl(210 40% 98%);
          margin: 0;
          line-height: 1.2;
        }
        .commerce-sidebar__logo-sub {
          font-size: 11px;
          color: hsl(215 20% 55%);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 130px;
        }
        .commerce-sidebar__close {
          display: none;
          margin-left: auto;
          color: hsl(215 20% 55%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        @media (max-width: 1023px) { .commerce-sidebar__close { display: flex; } }

        .commerce-sidebar__nav {
          flex: 1;
          padding: 12px 8px;
          overflow-y: auto;
        }
        .commerce-sidebar__group {
          margin-bottom: 20px;
        }
        .commerce-sidebar__section-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: hsl(215 20% 40%);
          padding: 0 8px;
          margin: 0 0 4px;
        }

        .commerce-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 13px;
          color: hsl(215 20% 60%);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          margin-bottom: 2px;
        }
        .commerce-nav-item:hover {
          background: hsl(222 47% 16%);
          color: hsl(210 40% 90%);
        }
        .commerce-nav-item--active {
          background: hsl(262 83% 20%);
          color: hsl(262 83% 80%);
          font-weight: 500;
        }
        .commerce-nav-item--active:hover {
          background: hsl(262 83% 22%);
        }
        .commerce-nav-item--muted { color: hsl(215 20% 45%); }
        .commerce-nav-item__icon { flex-shrink: 0; }
        .commerce-nav-item__chevron { margin-left: auto; opacity: 0.5; }

        .commerce-sidebar__footer {
          border-top: 1px solid hsl(222 47% 18%);
          padding: 8px;
        }

        /* ── Main ─────────────────────────────────────────────── */
        .commerce-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .commerce-topbar {
          display: none;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: hsl(222 47% 11%);
          position: sticky;
          top: 0;
          z-index: 30;
        }
        @media (max-width: 1023px) { .commerce-topbar { display: flex; } }
        .commerce-topbar__menu-btn {
          color: hsl(215 20% 70%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
        }
        .commerce-topbar__logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: hsl(210 40% 95%);
        }
        .commerce-content {
          flex: 1;
          padding: 24px;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
        }
        @media (max-width: 639px) { .commerce-content { padding: 16px; } }
      `}</style>
    </div>
  );
}

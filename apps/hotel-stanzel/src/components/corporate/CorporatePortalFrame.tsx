'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import CorporateWalletCreditModal from './CorporateWalletCreditModal';

type IconName = 'grid' | 'calendar' | 'receipt' | 'wallet' | 'sparkles' | 'menu' | 'arrow' | 'logout' | 'close';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'grid') return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 9.5h18" /></svg>;
  if (name === 'receipt') return <svg {...common}><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></svg>;
  if (name === 'wallet') return <svg {...common}><path d="M4 6.5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h13" /><path d="M16 13h5M17 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" /></svg>;
  if (name === 'sparkles') return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></svg>;
  if (name === 'menu') return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  if (name === 'close') return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === 'logout') return <svg {...common}><path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5M14 8l4 4-4 4M18 12H9" /></svg>;
  return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

const navItems: { href: string; label: string; description: string; icon: IconName }[] = [
  { href: '/corporate/dashboard', label: 'Overview', description: 'Account snapshot', icon: 'grid' },
  { href: '/corporate/book', label: 'New booking', description: 'Reserve a stay', icon: 'calendar' },
  { href: '/corporate/reservations', label: 'Reservations', description: 'Manage your stays', icon: 'receipt' },
  { href: '/corporate/invoices', label: 'City Ledger', description: 'Invoices and balance', icon: 'wallet' },
  { href: '/corporate/rates', label: 'Rate requests', description: 'Talk to our team', icon: 'sparkles' },
];

function isPortalPath(pathname: string) {
  return navItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

function currentPage(pathname: string) {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) || navItems[0];
}

export default function CorporatePortalFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!isPortalPath(pathname)) {
    return <><header className="corporate-public-header"><div className="container corporate-public-header-inner"><Link href="/corporate" className="corporate-public-brand"><span className="corporate-brand-mark">S</span><span>Stanzel Grand Resort</span></Link><Link href="/corporate/login" className="corporate-public-signin">Corporate portal <Icon name="arrow" size={15} /></Link></div></header><main className="corporate-public-main"><div className="container corporate-public-container">{children}</div></main><footer className="corporate-public-footer"><div className="container">Stanzel Grand Resort <span>·</span> Corporate services</div></footer></>;
  }

  const page = currentPage(pathname);
  async function signOut() {
    await fetch('/api/corporate-portal/login', { method: 'DELETE' });
    router.push('/corporate/login');
    router.refresh();
  }

  return <div className="portal-app-shell">
    {mobileOpen && <button className="portal-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`portal-sidebar${mobileOpen ? ' is-open' : ''}`}>
      <div className="portal-sidebar-brand"><span className="corporate-brand-mark">S</span><div><strong>Stanzel</strong><span>Corporate portal</span></div><button className="portal-close-button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><Icon name="close" size={19} /></button></div>
      <div className="portal-sidebar-context"><span className="portal-context-dot" /> <span>Business workspace</span></div>
      <nav className="portal-nav" aria-label="Corporate portal navigation">
        <span className="portal-nav-label">Workspace</span>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} className={`portal-nav-item${active ? ' is-active' : ''}`} onClick={() => setMobileOpen(false)}><span className="portal-nav-icon"><Icon name={item.icon} /></span><span className="portal-nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span>{active && <span className="portal-nav-active" />}</Link>;
        })}
      </nav>
      <div className="portal-sidebar-bottom"><div className="portal-help-card"><span className="portal-help-kicker">Need assistance?</span><strong>Our corporate team is here to help.</strong><a href="mailto:info@stanzelgrandresort.org">Contact support <Icon name="arrow" size={14} /></a></div><button className="portal-signout" onClick={signOut}><Icon name="logout" size={17} /> Sign out</button></div>
    </aside>
    <div className="portal-main-area">
      <header className="portal-topbar"><button className="portal-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Icon name="menu" size={21} /></button><div className="portal-breadcrumb"><span>Corporate portal</span><Icon name="arrow" size={13} /><strong>{page.label}</strong></div><div className="portal-topbar-actions"><span className="portal-live-status"><span /> Live account</span><div className="portal-user-chip"><span className="portal-user-avatar">C</span><span className="portal-user-label">Company account</span></div></div></header>
      <main className="portal-content"><div className="portal-page-heading"><div><span className="portal-page-kicker">{page.description}</span><h1>{page.label}</h1></div>{pathname === '/corporate/dashboard' && <div className="portal-heading-actions"><CorporateWalletCreditModal /><Link href="/corporate/book" className="portal-primary-action"><Icon name="calendar" size={17} /> New booking</Link></div>}</div>{children}</main>
    </div>
  </div>;
}

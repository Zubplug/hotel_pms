"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/* ─── Nav data ──────────────────────────────────────────── */
const NAV = [
  {
    label: "Products",
    groups: [
      {
        title: "LodgeCore Hospitality",
        href: "/hospitality",
        items: [
          { href: "/hospitality/pms",           label: "Property Management",  sub: "Reservations, rooms, guests & folios" },
          { href: "/hospitality/pos",            label: "Point of Sale",        sub: "Outlets, orders & room charges" },
          { href: "/hospitality/booking",        label: "Booking Engine",       sub: "Direct online bookings & OTA sync" },
          { href: "/hospitality/accounting",     label: "Finance & Accounting", sub: "Folios, billing & reporting" },
          { href: "/hospitality/housekeeping",   label: "Housekeeping",         sub: "Room readiness & task management" },
          { href: "/hospitality/events",         label: "Events & Banqueting",  sub: "Conferences, weddings & groups" },
          { href: "/hospitality/multi-property", label: "Multi-Property",       sub: "Manage groups & chains centrally" },
        ],
      },
      {
        title: "LodgeCore Access",
        href: "/access",
        items: [
          { href: "/access/hotel-locks",    label: "Hotel Electronic Locks", sub: "RFID, MIFARE & smart lock solutions" },
          { href: "/access/smart-locks",    label: "Smart Locks",            sub: "Mobile, PIN & biometric access" },
          { href: "/access/access-control", label: "Access Control",         sub: "Controllers, readers & door hardware" },
          { href: "/access/encoders",       label: "Card Encoders",          sub: "Key card & RFID programming" },
        ],
      },
      {
        title: "LodgeCore Smart",
        href: "/smart",
        items: [
          { href: "/smart/smart-hotel",       label: "Smart Hotel Rooms",   sub: "Automation, energy & guest experience" },
          { href: "/smart/smart-home",        label: "Smart Homes",         sub: "Locks, lighting, AC & automation" },
          { href: "/smart/smart-building",    label: "Smart Buildings",     sub: "BMS, access & energy management" },
          { href: "/smart/energy-management", label: "Energy Management",   sub: "Monitoring, control & optimisation" },
        ],
      },
    ],
  },
  {
    label: "Hardware",
    href: "/hardware",
    groups: [
      {
        title: "Electronic Locks",
        href: "/hardware/locks",
        items: [
          { href: "/hardware/locks",           label: "Hotel Locks",       sub: "RFID, MIFARE & smart locks" },
          { href: "/hardware/access-control",  label: "Access Control",    sub: "Controllers, readers & strikes" },
          { href: "/hardware/programming",     label: "Programming Tools", sub: "Card encoders & configurators" },
        ],
      },
      {
        title: "Smart Systems",
        href: "/hardware/smart-room",
        items: [
          { href: "/hardware/smart-room", label: "Smart Room Systems", sub: "Energy switches, sensors & panels" },
          { href: "/hardware/security",   label: "Security",           sub: "CCTV, NVR & intercom" },
          { href: "/hardware/networking", label: "Networking",         sub: "Routers, switches & Wi-Fi" },
        ],
      },
    ],
  },
  {
    label: "Solutions",
    groups: [
      {
        title: "By Property Type",
        href: "/solutions",
        items: [
          { href: "/solutions/hotels",      label: "Hotels & Resorts",    sub: "Full hospitality technology stack" },
          { href: "/solutions/apartments",  label: "Apartments",          sub: "Serviced & residential management" },
          { href: "/solutions/short-let",   label: "Short-Let Properties",sub: "Remote access & guest management" },
          { href: "/solutions/homes",       label: "Homes",               sub: "Smart security & automation" },
          { href: "/solutions/offices",     label: "Offices",             sub: "Access, visitors & automation" },
          { href: "/solutions/commercial",  label: "Commercial Buildings", sub: "BMS, energy & security" },
          { href: "/solutions/estates",     label: "Estates",             sub: "Gate, access & property technology" },
        ],
      },
    ],
  },
  {
    label: "Services",
    groups: [
      {
        title: "Deployment & Support",
        href: "/services",
        items: [
          { href: "/services/installation",  label: "Installation",    sub: "On-site hardware & system setup" },
          { href: "/services/integration",   label: "Integration",     sub: "System & API integration" },
          { href: "/services/deployment",    label: "Deployment",      sub: "Full property technology rollout" },
          { href: "/services/maintenance",   label: "Maintenance",     sub: "Preventive & reactive support" },
          { href: "/services/support",       label: "Technical Support",sub: "Remote & on-site assistance" },
        ],
      },
    ],
  },
  {
    label: "Company",
    href: "/about",
    groups: [
      {
        title: "Company",
        href: "/about",
        items: [
          { href: "/about",      label: "About LodgeCore", sub: "Our mission, team & story" },
          { href: "/partners",   label: "Partners",        sub: "Technology & integration partners" },
          { href: "/book-demo",  label: "Contact",         sub: "Talk to the LodgeCore team" },
          { href: "/pricing",    label: "Pricing",         sub: "Software, hardware & services" },
        ],
      },
    ],
  },
] as const;

/* ─── Mobile accordion item ─────────────────────────────── */
function MobileGroup({ label, items, close }: {
  label: string;
  items: readonly { href: string; label: string }[];
  close: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="drawer-group">
      <button className="drawer-group-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {label}
        <svg viewBox="0 0 10 6" fill="none" width="10" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="drawer-group-items">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="drawer-sub-link" onClick={close}>{it.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────── */
export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
      const doc = document.documentElement;
      const top = doc.scrollTop || document.body.scrollTop;
      const height = doc.scrollHeight - doc.clientHeight;
      setScrollPct(height > 0 ? (top / height) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <header
        className="site-header"
        style={scrolled ? { borderBottomColor: "rgba(255,255,255,.1)" } : {}}
        onMouseLeave={() => setActiveMenu(null)}
      >
        <div className="header-progress" style={{ width: `${scrollPct}%` }} aria-hidden="true" />
        <div className="header-inner">
          {/* Brand */}
          <Link href="/" className="brand" onClick={closeDrawer}>
            Lodge<span className="brand-core">Core</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="site-nav" aria-label="Main navigation">
            {NAV.map((item) => (
              <div
                key={item.label}
                className="nav-item"
                onMouseEnter={() => setActiveMenu(item.label)}
                onMouseLeave={() => setActiveMenu(null)}
              >
                {"href" in item ? (
                  <Link href={item.href} className="nav-link">{item.label}</Link>
                ) : (
                  <span className="nav-link" role="button" tabIndex={0}
                    onFocus={() => setActiveMenu(item.label)}
                    aria-haspopup="true" aria-expanded={activeMenu === item.label}
                  >
                    {item.label}
                    <svg className="nav-chevron" viewBox="0 0 10 6" fill="none" width="10" height="6">
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                {"groups" in item && item.groups && (
                  <div
                    className={`mega-panel${activeMenu === item.label ? " active" : ""}`}
                    role="menu"
                    aria-label={`${item.label} submenu`}
                  >
                    <div className="mega-panel-inner">
                      {item.groups.map((grp) => (
                        <div key={grp.title} className="mega-col">
                          <Link href={grp.href} className="mega-col-title">{grp.title} →</Link>
                          <div className="mega-items">
                            {grp.items.map((it) => (
                              <Link key={it.href} href={it.href} className="mega-item" role="menuitem" onClick={() => setActiveMenu(null)}>
                                <span className="mega-item-label">{it.label}</span>
                                <span className="mega-item-sub">{it.sub}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="header-actions">
            <Link href="/portal" className="header-signin">Sign in</Link>
            <Link href="/book-demo" className="btn btn-primary btn-sm">
              Talk to LodgeCore <span className="btn-arrow">→</span>
            </Link>
          </div>

          {/* Hamburger */}
          <button
            id="nav-hamburger"
            className={`hamburger${drawerOpen ? " open" : ""}`}
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {drawerOpen && <div className="mobile-backdrop" onClick={closeDrawer} aria-hidden="true" />}
      <nav
        id="mobile-drawer"
        className={`mobile-drawer${drawerOpen ? " open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!drawerOpen}
      >
        <div className="drawer-scroll">
          <MobileGroup label="Products" close={closeDrawer} items={[
            { href: "/hospitality", label: "LodgeCore Hospitality" },
            { href: "/hospitality/pms", label: "Property Management" },
            { href: "/hospitality/pos", label: "Point of Sale" },
            { href: "/hospitality/booking", label: "Booking Engine" },
            { href: "/access", label: "LodgeCore Access" },
            { href: "/access/hotel-locks", label: "Hotel Locks" },
            { href: "/access/access-control", label: "Access Control" },
            { href: "/smart", label: "LodgeCore Smart" },
            { href: "/hardware", label: "Hardware" },
          ]} />
          <MobileGroup label="Solutions" close={closeDrawer} items={[
            { href: "/solutions/hotels", label: "Hotels & Resorts" },
            { href: "/solutions/apartments", label: "Apartments" },
            { href: "/solutions/short-let", label: "Short-Let Properties" },
            { href: "/solutions/homes", label: "Homes" },
            { href: "/solutions/offices", label: "Offices" },
            { href: "/solutions/commercial", label: "Commercial Buildings" },
            { href: "/solutions/estates", label: "Estates" },
          ]} />
          <MobileGroup label="Services" close={closeDrawer} items={[
            { href: "/services/installation", label: "Installation" },
            { href: "/services/integration", label: "Integration" },
            { href: "/services/deployment", label: "Deployment" },
            { href: "/services/maintenance", label: "Maintenance" },
            { href: "/services/support", label: "Technical Support" },
          ]} />
          <MobileGroup label="Company" close={closeDrawer} items={[
            { href: "/about", label: "About LodgeCore" },
            { href: "/partners", label: "Partners" },
            { href: "/pricing", label: "Pricing" },
            { href: "/book-demo", label: "Contact" },
          ]} />
          <Link href="/integrations" className="drawer-link" onClick={closeDrawer}>Integrations <span>→</span></Link>
          <div className="drawer-actions">
            <Link href="/portal" className="btn btn-outline" style={{ width: "100%", justifyContent: "center" }} onClick={closeDrawer}>Sign in</Link>
            <Link href="/book-demo" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={closeDrawer}>Talk to LodgeCore →</Link>
          </div>
        </div>
      </nav>
    </>
  );
}

/* ─── Footer ─────────────────────────────────────────────── */
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,232,.3), rgba(167,139,250,.2), transparent)" }} />
      <div className="footer-upper">
        <div className="footer-brand">
          <Link href="/" className="brand" style={{ marginBottom: 14, display: "inline-block" }}>Lodge<span className="brand-core">Core</span></Link>
          <p>Property technology connecting software, access, hardware and automation for hotels, homes and modern properties.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
            {([["SOC 2","#00d4e8"],["GDPR","#3ef5a0"],["PCI DSS","#a78bfa"],["ISO 27001","#ffbe5a"]] as [string,string][]).map(([l,c])=>(
              <span key={l} style={{ fontFamily:"var(--font-mono)",fontSize:8,letterSpacing:".15em",textTransform:"uppercase",padding:"4px 8px",borderRadius:"var(--radius-pill)",border:`1px solid ${c}30`,background:`${c}08`,color:c }}>{l}</span>
            ))}
          </div>
        </div>
        <div className="footer-col">
          <h4>Divisions</h4>
          {([["/hospitality","LodgeCore Hospitality"],["/access","LodgeCore Access"],["/smart","LodgeCore Smart"],["/systems","LodgeCore Systems"],["/care","LodgeCore Care"]] as [string,string][]).map(([h,l])=><Link key={h} href={h}>{l}</Link>)}
        </div>
        <div className="footer-col">
          <h4>Solutions</h4>
          {([["/solutions/hotels","Hotels & Resorts"],["/solutions/apartments","Apartments"],["/solutions/short-let","Short-Let"],["/solutions/homes","Smart Homes"],["/solutions/offices","Offices"],["/solutions/estates","Estates"]] as [string,string][]).map(([h,l])=><Link key={h} href={h}>{l}</Link>)}
        </div>
        <div className="footer-col">
          <h4>Company</h4>
          {([["/about","About LodgeCore"],["/partners","Partners"],["/pricing","Pricing"],["/integrations","Integrations"],["/book-demo","Contact"],["/portal","Customer Portal"],["/privacy","Privacy"],["/terms","Terms"]] as [string,string][]).map(([h,l])=><Link key={h} href={h}>{l}</Link>)}
        </div>
      </div>
      <div className="footer-lower">
        <span>© {year} LodgeCore · Property Technology Platform</span>
        <span style={{ fontFamily:"var(--font-mono)",fontSize:9,color:"var(--text-muted)",opacity:.5,letterSpacing:".08em" }}>Powering Smarter Properties.</span>
      </div>
    </footer>
  );
}

/* ─── Shared inner-page shell ────────────────────────────── */
export function PublicShell({
  eyebrow, title, description, children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="site-shell">
      <PublicHeader />
      <section style={{ paddingTop: 130, paddingBottom: 72, position: "relative", overflow: "hidden" }}>
        {/* Ambient glow */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,212,232,.06) 0%, transparent 70%)",
        }} />
        {/* Grid */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: .02,
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div className="contain" style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
            letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)",
            marginBottom: 18, padding: "5px 12px",
            border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)",
            background: "var(--accent-dim)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            {eyebrow}
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 900,
            fontSize: "clamp(2rem,5vw,3.6rem)", letterSpacing: "-.065em",
            lineHeight: .9, color: "var(--text-primary)", marginBottom: 20,
            maxWidth: 700, whiteSpace: "pre-line",
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: 16, lineHeight: 1.75, color: "var(--text-secondary)",
            maxWidth: 580,
          }}>
            {description}
          </p>
        </div>
      </section>
      {children}
      <PublicFooter />
    </main>
  );
}


'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { label: 'Rooms & Suites', href: '/rooms' },
  { label: 'Dining', href: '/dining' },
  { label: 'Facilities', href: '/facilities' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Solid header on all non-homepage pages or when scrolled
  const isHomepage = pathname === '/';
  const transparent = isHomepage && !scrolled;

  useEffect(() => {
    if (!isHomepage) return;
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, [isHomepage]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <>
      <header
        id="site-header"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 'var(--nav-height)',
          transition: 'background-color 400ms var(--ease), box-shadow 400ms var(--ease)',
          backgroundColor: transparent ? 'transparent' : 'var(--color-green)',
          boxShadow: transparent ? 'none' : '0 2px 24px rgb(0 0 0 / 0.18)',
        }}
      >
        <div
          className="container"
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            id="logo-link"
            aria-label="Stanzel Grand Resort homepage"
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
              fontWeight: 600,
              color: transparent ? 'var(--color-ivory)' : 'var(--color-gold)',
              letterSpacing: '0.04em',
              lineHeight: 1,
            }}>
              Stanzel
            </span>
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.6rem',
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: transparent ? 'rgba(250,248,244,0.75)' : 'rgba(201,169,110,0.75)',
              lineHeight: 1,
            }}>
              Grand Resort
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}
            className="desktop-nav">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: transparent ? 'rgba(250,248,244,0.9)' : 'rgba(250,248,244,0.8)',
                  transition: 'color var(--duration-sm) var(--ease)',
                  borderBottom: pathname === href ? '1px solid var(--color-gold)' : '1px solid transparent',
                  paddingBottom: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-gold)')}
                onMouseLeave={e => (e.currentTarget.style.color = transparent ? 'rgba(250,248,244,0.9)' : 'rgba(250,248,244,0.8)')}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Book CTA + burger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Link href="/booking" id="header-book-btn" className="btn btn-primary btn-sm"
              style={{ whiteSpace: 'nowrap' }}>
              Book Now
            </Link>
            <button
              id="mobile-menu-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
              className="burger-btn"
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--space-2)',
                color: 'var(--color-ivory)',
                display: 'none',
              }}
            >
              {menuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 98,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Mobile drawer */}
      <nav
        id="mobile-nav"
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 99,
          width: 'min(320px, 90vw)',
          background: 'var(--color-green)',
          padding: 'var(--space-8) var(--space-6)',
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--duration-lg) var(--ease)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
          overflowY: 'auto',
        }}
      >
        <div style={{ marginBottom: 'var(--space-8)', marginTop: 'calc(var(--nav-height) + var(--space-4))' }}>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Navigation</p>
        </div>
        {NAV_LINKS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuOpen(false)}
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 400,
              color: pathname === href ? 'var(--color-gold)' : 'var(--color-ivory)',
              padding: 'var(--space-3) 0',
              borderBottom: '1px solid rgba(250,248,244,0.1)',
              transition: 'color var(--duration-sm) var(--ease)',
            }}
          >
            {label}
          </Link>
        ))}
        <Link href="/booking" onClick={() => setMenuOpen(false)}
          className="btn btn-primary" style={{ marginTop: 'var(--space-6)' }}>
          Book Your Stay
        </Link>
      </nav>

      <style>{`
        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .burger-btn { display: block !important; }
        }
      `}</style>
    </>
  );
}

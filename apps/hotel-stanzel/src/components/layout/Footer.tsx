import Link from 'next/link';

const FOOTER_LINKS = {
  'Stay': [
    { label: 'Rooms & Suites', href: '/rooms' },
    { label: 'Special Offers', href: '/offers' },
    { label: 'Book Now', href: '/booking' },
    { label: 'Manage Booking', href: '/manage' },
  ],
  'Experience': [
    { label: 'Dining & Bar', href: '/dining' },
    { label: 'Facilities', href: '/facilities' },
    { label: 'Gallery', href: '/gallery' },
  ],
  'Resort': [
    { label: 'About Us', href: '/about' },
    { label: 'Location', href: '/location' },
    { label: 'Contact', href: '/contact' },
  ],
  'Legal': [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms & Conditions', href: '/terms' },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ background: 'var(--color-green-dark)', color: 'var(--color-ivory)' }} role="contentinfo">
      {/* Upper footer */}
      <div className="container" style={{ paddingBlock: 'var(--space-20)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-12)',
        }}>
          {/* Brand column */}
          <div style={{ gridColumn: 'span 1' }}>
            <Link href="/" aria-label="Stanzel Grand Resort homepage"
              style={{ display: 'inline-block', marginBottom: 'var(--space-5)' }}>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-serif)',
                fontSize: 'var(--text-2xl)',
                fontWeight: 500,
                color: 'var(--color-gold)',
                letterSpacing: '0.04em',
                lineHeight: 1.1,
              }}>
                Stanzel
              </span>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.6rem',
                fontWeight: 600,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(201,169,110,0.65)',
                marginTop: 3,
              }}>
                Grand Resort
              </span>
            </Link>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'rgba(250,248,244,0.55)',
              lineHeight: 1.7,
              maxWidth: '220px',
            }}>
              Exceptional hospitality, curated luxury, and genuine Nigerian warmth.
            </p>
            {/* Divider */}
            <div style={{ width: 40, height: 2, background: 'var(--color-gold)', marginTop: 'var(--space-6)', opacity: 0.5 }} />
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-gold)',
                marginBottom: 'var(--space-5)',
                opacity: 0.8,
              }}>
                {category}
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {links.map(({ label, href }) => (
                  <li key={href}>
                    <Link href={href} className="footer-link">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Lower footer */}
      <div style={{ borderTop: '1px solid rgba(250,248,244,0.08)' }}>
        <div className="container" style={{
          paddingBlock: 'var(--space-6)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
        }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(250,248,244,0.35)' }}>
            © {currentYear} Stanzel Grand Resort. All rights reserved.
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(250,248,244,0.25)' }}>
            Powered by{' '}
            <span style={{ color: 'rgba(201,169,110,0.5)' }}>LodgeCore</span>
          </p>
        </div>
      </div>
      {/* CSS hover — no JS event handlers in Server Components */}
      <style>{`
        .footer-link {
          font-family: var(--font-sans);
          font-size: var(--text-sm);
          color: rgba(250,248,244,0.65);
          transition: color var(--duration-sm) var(--ease);
        }
        .footer-link:hover {
          color: var(--color-ivory);
        }
      `}</style>
    </footer>
  );
}

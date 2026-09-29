import Link from "next/link";

export function PublicHeader() {
  return <header className="site-header"><div className="header-inner"><Link href="/" className="brand">Lodge<span>Core</span></Link><nav><Link href="/platform/pms">Platform</Link><Link href="/hardware">Hardware</Link><Link href="/integrations">Integrations</Link><Link href="/pricing">Pricing</Link></nav><div className="header-actions"><Link href="/portal" className="sign-in">Sign in</Link><Link href="/book-demo" className="header-cta">Book a demo <span>↗</span></Link></div></div></header>;
}

export function PublicFooter() {
  return <footer className="site-footer"><div className="footer-top"><div><Link href="/" className="brand">Lodge<span>Core</span></Link><p>The operating system for modern hotels.</p></div><div className="footer-links"><div><b>Platform</b><Link href="/platform/pms">PMS</Link><Link href="/platform/front-desk">Front desk</Link><Link href="/platform/pos">F&amp;B &amp; POS</Link></div><div><b>Company</b><Link href="/integrations">Integrations</Link><Link href="/pricing">Pricing</Link><Link href="/book-demo">Contact sales</Link></div><div><b>Access</b><Link href="/portal">Customer portal</Link><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} LodgeCore</span><span>Hospitality operations, connected.</span></div></footer>;
}

export function PublicShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="site-shell"><PublicHeader /><section className="page-hero"><div className="section-kicker">{eyebrow}</div><h1>{title}</h1><p>{description}</p></section>{children}<PublicFooter /></main>;
}

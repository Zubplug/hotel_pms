import type { ReactNode } from "react";

export type BookingTemplateKey = "CLASSIC_HOTEL" | "MODERN_BOUTIQUE" | "RESORT" | "BUSINESS_HOTEL";

type Props = {
  templateKey: string;
  siteName: string;
  logoUrl: string | null;
  tagline: string | null;
  children: ReactNode;
};

const templateNames: Record<BookingTemplateKey, string> = {
  CLASSIC_HOTEL: "Classic Hotel",
  MODERN_BOUTIQUE: "Modern Boutique",
  RESORT: "Resort",
  BUSINESS_HOTEL: "Business Hotel",
};

function Brand({ siteName, logoUrl, compact = false }: { siteName: string; logoUrl: string | null; compact?: boolean }) {
  return (
    <div className={`bk-brand${compact ? " bk-brand-compact" : ""}`}>
      {logoUrl ? <img src={logoUrl} alt={siteName} /> : <span className="bk-brand-mark">{siteName.slice(0, 2).toUpperCase()}</span>}
      <span className="bk-brand-name">{siteName}</span>
    </div>
  );
}

function TrustBar() {
  return (
    <div className="bk-trust-bar" aria-label="Booking benefits">
      <span><i>✦</i> Live availability</span>
      <span><i>✓</i> Best direct rate</span>
      <span><i>⌁</i> Secure checkout</span>
    </div>
  );
}

function Header({ siteName, logoUrl, tagline, compact = false }: Omit<Props, "children" | "templateKey"> & { compact?: boolean }) {
  return (
    <header className={`bk-header${compact ? " bk-header-compact" : ""}`}>
      <div className="bk-header-inner">
        <a className="bk-brand-link" href="#top" aria-label={`${siteName} booking home`}><Brand siteName={siteName} logoUrl={logoUrl} compact={compact} /></a>
        <div className="bk-header-meta">
          {tagline && <span className="bk-header-tagline">{tagline}</span>}
          <span className="bk-secure-label"><span className="bk-secure-dot" /> Direct booking</span>
        </div>
      </div>
    </header>
  );
}

function Hero({ siteName, tagline, variant }: { siteName: string; tagline: string | null; variant: string }) {
  return (
    <section className={`bk-hero bk-hero-${variant}`} aria-labelledby="booking-hero-title">
      <div className="bk-hero-glow" aria-hidden="true" />
      <div className="bk-hero-content">
        <div className="bk-kicker"><span className="bk-kicker-line" /> Direct reservations · {siteName}</div>
        <h1 id="booking-hero-title">{tagline || (variant === "resort" ? "Arrive somewhere beautiful" : variant === "boutique" ? "Stay with intention" : variant === "business" ? "A better way to stay" : "Your stay, made simple")}</h1>
        <p>Check live availability and secure your stay directly with {siteName}.</p>
        <TrustBar />
      </div>
      <div className="bk-hero-orbit" aria-hidden="true"><span /> <span /> <span /></div>
    </section>
  );
}

function Footer({ siteName }: { siteName: string }) {
  return (
    <footer className="bk-footer">
      <div className="bk-footer-inner">
        <Brand siteName={siteName} logoUrl={null} compact />
        <div><span>Secure direct reservations</span><span className="bk-footer-divider">·</span><span>Powered by LodgeCore</span></div>
      </div>
    </footer>
  );
}

function Shell({ children, templateKey, siteName, logoUrl, tagline, compact = false }: Props & { compact?: boolean }) {
  const key = ({ CLASSIC_HOTEL: "classic", MODERN_BOUTIQUE: "modern-boutique", RESORT: "resort", BUSINESS_HOTEL: "business" } as Record<string, string>)[templateKey] ?? "classic";
  return (
    <div id="top" className={`bk-site bk-site-${key}`} data-template={templateNames[templateKey as BookingTemplateKey] ?? templateKey}>
      <Header siteName={siteName} logoUrl={logoUrl} tagline={tagline} compact={compact} />
      {children}
      <Footer siteName={siteName} />
    </div>
  );
}

function ClassicHotel(props: Omit<Props, "templateKey">) {
  return <Shell {...props} templateKey="CLASSIC_HOTEL"><main className="bk-template-width bk-content"><div className="bk-section-rule"><span>Reserve your stay</span></div>{props.children}</main></Shell>;
}

function ModernBoutique(props: Omit<Props, "templateKey">) {
  return <Shell {...props} templateKey="MODERN_BOUTIQUE"><main className="bk-template-width bk-content"><div className="bk-section-rule"><span>Find your room</span></div>{props.children}</main></Shell>;
}

function Resort(props: Omit<Props, "templateKey">) {
  return <Shell {...props} templateKey="RESORT"><main className="bk-template-width bk-content"><div className="bk-section-rule"><span>Plan your escape</span></div>{props.children}</main></Shell>;
}

function BusinessHotel(props: Omit<Props, "templateKey">) {
  return <Shell {...props} templateKey="BUSINESS_HOTEL" compact><main className="bk-template-width bk-content"><div className="bk-section-rule"><span>Book your stay</span></div>{props.children}</main></Shell>;
}

export function BookingTemplate(props: Props) {
  switch (props.templateKey as BookingTemplateKey) {
    case "MODERN_BOUTIQUE": return <ModernBoutique {...props} />;
    case "RESORT": return <Resort {...props} />;
    case "BUSINESS_HOTEL": return <BusinessHotel {...props} />;
    default: return <ClassicHotel {...props} />;
  }
}

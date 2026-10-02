import type { ReactNode } from "react";

export type BookingTemplateKey = "CLASSIC_HOTEL" | "MODERN_BOUTIQUE" | "RESORT" | "BUSINESS_HOTEL";

type Props = {
  templateKey: string;
  siteName: string;
  logoUrl: string | null;
  tagline: string | null;
  children: ReactNode;
};

function Brand({ siteName, logoUrl, compact = false }: { siteName: string; logoUrl: string | null; compact?: boolean }) {
  return <div style={{ display: "flex", alignItems: "center", gap: compact ? 9 : 12 }}>
    {logoUrl ? <img src={logoUrl} alt={siteName} style={{ height: compact ? 30 : 36, width: "auto", objectFit: "contain" }} /> : <div style={{ width: compact ? 30 : 36, height: compact ? 30 : 36, borderRadius: compact ? 6 : 8, background: "var(--bk-primary)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: compact ? 12 : 14 }}>{siteName.slice(0, 2).toUpperCase()}</div>}
    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: compact ? 15 : 16, letterSpacing: "-.04em" }}>{siteName}</span>
  </div>;
}

function Footer({ siteName }: { siteName: string }) {
  return <footer style={{ borderTop: "1px solid var(--bk-border)", background: "var(--bk-surface)", padding: "20px 24px", textAlign: "center", fontSize: 11, color: "var(--bk-muted)" }}>
    <p>Secure booking powered by <strong>{siteName}</strong> · <span style={{ color: "var(--bk-primary)" }}>LodgeCore</span></p>
  </footer>;
}

function ClassicHotel({ siteName, logoUrl, tagline, children }: Omit<Props, "templateKey">) {
  return <Shell><header style={{ background: "var(--bk-surface)", borderBottom: "1px solid var(--bk-border)", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}><div className="bk-template-width" style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><div><Brand siteName={siteName} logoUrl={logoUrl} />{tagline && <div style={{ fontSize: 11, color: "var(--bk-muted)", margin: "3px 0 0 48px" }}>{tagline}</div>}</div><Trust /></div></header><Content>{children}</Content><Footer siteName={siteName} /></Shell>;
}

function ModernBoutique({ siteName, logoUrl, tagline, children }: Omit<Props, "templateKey">) {
  return <Shell><header style={{ background: "#111827", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}><div className="bk-template-width" style={{ minHeight: 74, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><div style={{ color: "#fff" }}><Brand siteName={siteName} logoUrl={logoUrl} /><div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", opacity: .65, marginTop: 6 }}>{tagline ?? "Stay somewhere memorable"}</div></div><span style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", opacity: .7 }}>Direct booking</span></div></header><main style={{ background: "linear-gradient(180deg,#111827 0,#1f2937 180px,var(--bk-bg) 420px)", paddingTop: 1 }}><Content>{children}</Content></main><Footer siteName={siteName} /></Shell>;
}

function Resort({ siteName, logoUrl, tagline, children }: Omit<Props, "templateKey">) {
  return <Shell><header style={{ background: "linear-gradient(110deg,var(--bk-primary),var(--bk-secondary))", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}><div className="bk-template-width" style={{ minHeight: 78, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><div><Brand siteName={siteName} logoUrl={logoUrl} /><div style={{ fontSize: 11, marginTop: 5, opacity: .85 }}>{tagline ?? "Relax, reconnect, and stay awhile"}</div></div><span style={{ fontSize: 12, border: "1px solid rgba(255,255,255,.45)", borderRadius: 999, padding: "7px 12px" }}>Best available rate</span></div></header><Content>{children}</Content><Footer siteName={siteName} /></Shell>;
}

function BusinessHotel({ siteName, logoUrl, tagline, children }: Omit<Props, "templateKey">) {
  return <Shell><header style={{ background: "var(--bk-surface)", borderBottom: "3px solid var(--bk-primary)", position: "sticky", top: 0, zIndex: 50 }}><div className="bk-template-width" style={{ minHeight: 54, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><div><Brand siteName={siteName} logoUrl={logoUrl} compact />{tagline && <span style={{ fontSize: 11, color: "var(--bk-muted)", marginLeft: 14 }}>{tagline}</span>}</div><span style={{ fontSize: 11, color: "var(--bk-muted)" }}>Secure reservations</span></div></header><Content>{children}</Content><Footer siteName={siteName} /></Shell>;
}

function Shell({ children }: { children: ReactNode }) { return <div style={{ minHeight: "100svh", background: "var(--bk-bg)", color: "var(--bk-text)", fontFamily: "var(--font-body)" }}>{children}</div>; }
function Content({ children }: { children: ReactNode }) { return <main className="bk-template-width" style={{ padding: "32px 24px 80px" }}>{children}</main>; }
function Trust() { return <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--bk-muted)" }}><span>★ Best Rate Guaranteed</span><span>▣ Secure Booking</span><span>◷ Instant Confirmation</span></div>; }

export function BookingTemplate(props: Props) {
  const common = { siteName: props.siteName, logoUrl: props.logoUrl, tagline: props.tagline, children: props.children };
  switch (props.templateKey as BookingTemplateKey) {
    case "MODERN_BOUTIQUE": return <ModernBoutique {...common} />;
    case "RESORT": return <Resort {...common} />;
    case "BUSINESS_HOTEL": return <BusinessHotel {...common} />;
    default: return <ClassicHotel {...common} />;
  }
}

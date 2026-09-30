import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Solutions — Property Technology for Every Vertical | LodgeCore",
  description: "LodgeCore property technology solutions for hotels, resorts, apartments, short-let properties, homes, offices, commercial buildings and estates.",
};

const SOLUTIONS = [
  { href: "/solutions/hotels",     icon: "🏨", name: "Hotels & Resorts",     desc: "Complete hospitality technology — PMS, POS, booking engine, access control, smart rooms and full operations management.", tags: ["PMS", "POS", "Booking", "Access", "Smart"] },
  { href: "/solutions/apartments", icon: "🏢", name: "Apartments",           desc: "Serviced and residential apartment management with access control, smart locks and property management software.",        tags: ["Access", "Smart Locks", "Management"] },
  { href: "/solutions/short-let",  icon: "🏡", name: "Short-Let Properties", desc: "Remote guest access, automated check-in, Bluetooth locks, energy management and property monitoring for short-let operators.", tags: ["Remote Access", "Smart", "Monitoring"] },
  { href: "/solutions/homes",      icon: "🏠", name: "Homes",                desc: "Smart locks, lighting, AC control, security cameras, automation and smart home technology for residences.",               tags: ["Smart Locks", "Lighting", "Security"] },
  { href: "/solutions/offices",    icon: "🏗", name: "Offices",              desc: "Access control, visitor management, smart building automation and energy management for office environments.",              tags: ["Access Control", "Automation", "Energy"] },
  { href: "/solutions/commercial", icon: "🏛", name: "Commercial Buildings", desc: "Building management systems, energy monitoring, access infrastructure and security for commercial properties.",           tags: ["BMS", "Energy", "Access", "Security"] },
  { href: "/solutions/estates",    icon: "🌿", name: "Estates",              desc: "Gate access, smart homes, perimeter security and integrated estate technology management.",                                tags: ["Gate Access", "Smart", "Security"] },
] as const;

export default function SolutionsPage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      <section style={{ paddingTop: 140, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 60% 50% at 40% 40%, rgba(0,212,232,.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div className="contain">
          <div className="section-kicker">Solutions</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem,5vw,4rem)", fontWeight: 800, letterSpacing: "-.06em", lineHeight: .92, color: "var(--text-primary)", marginBottom: 24, maxWidth: 680 }}>
            Technology Built for<br />Every Property Type.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 540, marginBottom: 36 }}>
            Whether you run a hotel, manage an apartment complex, operate short-let properties or develop commercial buildings — LodgeCore has a solution tailored to your property type.
          </p>
          <Link href="/book-demo" className="btn btn-primary">Find your solution →</Link>
        </div>
      </section>

      <section className="section-gap">
        <div className="contain">
          <div className="solutions-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {SOLUTIONS.map((sol) => (
              <Link key={sol.href} href={sol.href} className="solution-card">
                <div className="solution-icon">{sol.icon}</div>
                <div className="solution-name">{sol.name}</div>
                <div className="solution-desc">{sol.desc}</div>
                <div className="solution-tech">
                  {sol.tags.map((t) => <span key={t} className="solution-tag">{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="contain" style={{ textAlign: "center" }}>
          <h2 className="cta-title">Not Sure Which Solution Fits?</h2>
          <p className="cta-body">Talk to the LodgeCore team and we&apos;ll design a solution tailored to your property type, size and requirements.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
            <Link href="/book-demo" className="btn btn-primary btn-lg">Talk to an expert →</Link>
            <Link href="/hospitality" className="btn btn-outline btn-lg">Explore products</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

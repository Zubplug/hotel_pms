"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PublicHeader, PublicFooter } from "@/components/public-shell";

/* ─── Types ─────────────────────────────────────────────── */
type DivisionType = {
  href: string;
  icon: string;
  color: string;
  colorRgb: string;
  label: string;
  title: string;
  desc: string;
  caps: readonly string[];
  wide?: boolean;
};

/* ─── Data ─────────────────────────────────────────────── */
const DIVISIONS: DivisionType[] = [
  {
    href: "/hospitality",
    icon: "🏨",
    color: "#00d4e8",
    colorRgb: "0,212,232",
    label: "Hospitality",
    title: "Hotel & Resort Operations",
    desc: "The complete operating system for hotels — PMS, POS, booking engine, housekeeping, finance and multi-property management in one connected platform.",
    caps: ["PMS", "POS", "Booking", "Housekeeping", "Finance", "Events"],
    wide: true,
  },
  {
    href: "/access",
    icon: "🔑",
    color: "#3ef5a0",
    colorRgb: "62,245,160",
    label: "Access",
    title: "Electronic Access",
    desc: "RFID hotel locks, smart locks, access control and key card systems. Supplied, installed and integrated with the PMS.",
    caps: ["Hotel Locks", "RFID", "Smart Locks", "Access Control", "Encoders"],
  },
  {
    href: "/smart",
    icon: "⚡",
    color: "#a78bfa",
    colorRgb: "167,139,250",
    label: "Smart",
    title: "Smart Rooms & Automation",
    desc: "Automate rooms, homes and buildings. Energy management, sensors, AC and lighting — connected and controllable.",
    caps: ["Smart Rooms", "Smart Homes", "Energy", "Automation", "IoT"],
  },
  {
    href: "/systems",
    icon: "🔧",
    color: "#ffbe5a",
    colorRgb: "255,190,90",
    label: "Systems",
    title: "Deployment & Integration",
    desc: "Supply, install, configure and integrate every technology layer of your property.",
    caps: ["Installation", "Integration", "Migration", "Training"],
  },
  {
    href: "/care",
    icon: "🛡️",
    color: "#ff8c60",
    colorRgb: "255,140,96",
    label: "Care",
    title: "Support & Maintenance",
    desc: "Remote monitoring, preventive maintenance, emergency callout and technical support after deployment.",
    caps: ["Remote Support", "On-Site", "Maintenance", "Monitoring"],
  },
];

const METRICS = [
  { num: "500", suffix: "+", label: "Rooms Managed", sub: "Across all properties" },
  { num: "50",  suffix: "+", label: "Properties",    sub: "Hotels, homes & offices" },
  { num: "10K", suffix: "+", label: "Transactions",  sub: "Processed monthly" },
  { num: "20",  suffix: "+", label: "Integrations",  sub: "Connected platforms" },
];

const JOURNEY = [
  { n: "01", icon: "📅", title: "Reservation",    sub: "Guest books via OTA or booking engine" },
  { n: "02", icon: "🛎",  title: "Check-in",       sub: "PMS processes arrival & identity" },
  { n: "03", icon: "🃏",  title: "Key Issued",     sub: "Card or mobile key generated instantly" },
  { n: "04", icon: "🔓",  title: "Door Access",    sub: "Lock validates and grants entry" },
  { n: "05", icon: "💡",  title: "Room Activates", sub: "Energy, AC & lighting automatically on" },
  { n: "06", icon: "🍽",  title: "Hotel Services", sub: "Dining, spa & amenities tracked to folio" },
  { n: "07", icon: "💳",  title: "POS Charges",    sub: "All spend posted in real-time to PMS" },
  { n: "08", icon: "📄",  title: "Checkout",       sub: "Folio settled, receipt sent to guest" },
  { n: "09", icon: "🔒",  title: "Key Revoked",    sub: "Lock access automatically updated" },
  { n: "10", icon: "📊",  title: "Analytics",      sub: "Insights for operations & revenue" },
];

const TESTIMONIALS = [
  {
    initials: "AO",
    name: "Adebayo Okafor",
    role: "GM · Grand Meridian Hotel",
    quote: "LodgeCore replaced three separate systems. Front desk, housekeeping and POS all in one — the team adopted it in a day. The PMS-to-lock integration is seamless.",
    stars: 5,
  },
  {
    initials: "IN",
    name: "Ifeoma Nwosu",
    role: "Director of Operations · The Pinnacle Suites",
    quote: "We deployed 80 smart locks, AC control and the LodgeCore PMS across two floors in a week. The Systems team handled everything. Night audit now takes 3 minutes.",
    stars: 5,
  },
  {
    initials: "TM",
    name: "Taiwo Mensah",
    role: "Owner · Coral Bay Serviced Apartments",
    quote: "Remote check-in, smart lock access and automated energy management across 24 apartments. Guests love the experience. I manage everything from my phone.",
    stars: 5,
  },
];

const SOLUTIONS = [
  { href: "/solutions/hotels",     icon: "🏨", name: "Hotels & Resorts",     tags: ["PMS", "Access", "Smart"] },
  { href: "/solutions/apartments", icon: "🏢", name: "Apartments",            tags: ["Access", "Management"] },
  { href: "/solutions/short-let",  icon: "🏡", name: "Short-Let Properties", tags: ["Remote Access", "IoT"] },
  { href: "/solutions/homes",      icon: "🏠", name: "Smart Homes",           tags: ["Smart", "Security"] },
  { href: "/solutions/offices",    icon: "🏗", name: "Offices",               tags: ["Access", "Automation"] },
  { href: "/solutions/commercial", icon: "🏛", name: "Commercial Buildings", tags: ["BMS", "Energy"] },
  { href: "/solutions/estates",    icon: "🌿", name: "Estates",               tags: ["Gate", "Smart", "Access"] },
];

/* ─── Animated Counter ──────────────────────────────────── */
function AnimatedCounter({ num, suffix }: { num: string; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <span ref={ref} style={{
      opacity: shown ? 1 : 0,
      transform: shown ? "none" : "translateY(10px)",
      transition: "opacity .8s var(--ease), transform .8s var(--ease)",
    }}>
      {num}<span className="accent">{suffix}</span>
    </span>
  );
}

/* ─── Scroll Reveal ─────────────────────────────────────── */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : "translateY(28px)",
      transition: `opacity .7s ${delay}ms cubic-bezier(.25,.46,.45,.94), transform .7s ${delay}ms cubic-bezier(.25,.46,.45,.94)`,
    }}>
      {children}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — HERO
         ══════════════════════════════════════════════════════ */}
      <section className="hero-v2">
        {/* Ambient background glows */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 55% 60% at 70% 40%, rgba(0,212,232,.07) 0%, transparent 65%), radial-gradient(ellipse 40% 50% at 10% 70%, rgba(167,139,250,.05) 0%, transparent 60%), radial-gradient(ellipse 30% 30% at 90% 10%, rgba(62,245,160,.04) 0%, transparent 60%)",
        }} />
        {/* Grid overlay */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: .025,
          backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        <div className="contain" style={{ width: "100%", position: "relative", zIndex: 1 }}>
          <div className="hero-v2-grid">
            {/* Left: Copy */}
            <div>
              <div className="glass-pill" style={{ marginBottom: 24 }}>
                <span className="dot" />
                Property Technology Platform
              </div>

              <h1 className="hero-v2-headline">
                Technology That<br />
                <span className="gradient-text">Powers Smarter</span><br />
                Properties.
              </h1>

              <p className="hero-v2-sub">
                LodgeCore connects hospitality software, electronic access, smart rooms,
                automation and hardware in one integrated ecosystem for hotels, homes and modern properties.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 48 }}>
                <Link href="/hospitality" className="btn btn-primary btn-lg" style={{ background: "linear-gradient(135deg, #00d4e8, #0099aa)", border: "none", boxShadow: "0 0 32px rgba(0,212,232,.25), 0 4px 16px rgba(0,0,0,.3)" }}>
                  Explore the Platform →
                </Link>
                <Link href="/book-demo" className="btn btn-outline btn-lg">
                  Book a Demo
                </Link>
              </div>

              {/* Trust strip */}
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 24, paddingTop: 20,
                borderTop: "1px solid var(--border)",
              }}>
                {[
                  { icon: "🏨", val: "Hotels & Homes", sub: "Every property type" },
                  { icon: "🔑", val: "Hardware Included", sub: "Supply & installation" },
                  { icon: "🌍", val: "End-to-End", sub: "Software + hardware + care" },
                ].map((t) => (
                  <div key={t.val} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, color: "var(--text-primary)", letterSpacing: "-.02em" }}>{t.val}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>{t.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Dashboard preview image */}
            <div>
              <div className="hero-v2-image-wrap">
                <Image
                  src="/hero-dashboard.png"
                  alt="LodgeCore PMS dashboard — reservation calendar with room status, occupancy metrics and guest profile"
                  width={720}
                  height={540}
                  priority
                  style={{ width: "100%", height: "auto" }}
                />
                <div className="hero-v2-image-badge">
                  {[
                    { dot: "#3ef5a0", label: "PMS Live" },
                    { dot: "#00d4e8", label: "87% Occ." },
                    { dot: "#ffbe5a", label: "14 Arrivals" },
                  ].map((b) => (
                    <span key={b.label} className="hero-badge-chip">
                      <span className="dot" style={{ background: b.dot, boxShadow: `0 0 6px ${b.dot}` }} />
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — ANIMATED METRICS STRIP
         ══════════════════════════════════════════════════════ */}
      <section style={{ padding: "0 0 0" }}>
        <div className="contain">
          <Reveal>
            <div className="metrics-strip">
              {METRICS.map((m) => (
                <div key={m.label} className="metric-cell">
                  <div className="metric-num">
                    <AnimatedCounter num={m.num} suffix={m.suffix} />
                  </div>
                  <div className="metric-label">{m.label}</div>
                  <div className="metric-sub">{m.sub}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — FIVE DIVISION BENTO GRID
         ══════════════════════════════════════════════════════ */}
      <section className="section-gap">
        <div className="contain">
          <Reveal>
            <div style={{ marginBottom: 48 }}>
              <div className="section-kicker">The LodgeCore Platform</div>
              <h2 className="section-title" style={{ maxWidth: 700 }}>
                Five Divisions. One Integrated Ecosystem.
              </h2>
              <p className="section-body" style={{ maxWidth: 560 }}>
                From the software running your front desk to the lock on your guestroom door — LodgeCore covers every layer.
              </p>
            </div>
          </Reveal>

          <div className="div-bento-grid">
            {DIVISIONS.map((div, i) => (
              <Reveal key={div.href} delay={i * 80}>
                <Link
                  href={div.href}
                  className={`div-bento-card ${div.wide ? "div-bento-wide" : ""}`}
                  style={{ "--div-color": div.color, "--div-color-rgb": div.colorRgb } as React.CSSProperties}
                >
                  <div className="div-bento-icon">{div.icon}</div>
                  <div className="div-bento-label">LodgeCore {div.label}</div>
                  <div className="div-bento-title">{div.title}</div>
                  <div className="div-bento-desc">{div.desc}</div>
                  <div className="div-bento-caps">
                    {div.caps.map((c) => <span key={c} className="div-bento-cap">{c}</span>)}
                  </div>
                  <span className="div-bento-arrow">Explore →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — SOFTWARE MEETS HARDWARE (Feature Row)
         ══════════════════════════════════════════════════════ */}
      <section className="section-gap" style={{ background: "var(--surface-1)" }}>
        <div className="contain">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            <Reveal>
              <div style={{
                borderRadius: "var(--radius-xl)", overflow: "hidden",
                boxShadow: "0 24px 80px rgba(0,0,0,.5), 0 0 60px rgba(62,245,160,.08)",
                border: "1px solid rgba(62,245,160,.12)",
              }}>
                <Image
                  src="/hotel-lock.png"
                  alt="LodgeCore electronic RFID hotel lock with PMS integration — access granted to guest Sarah Jenkins"
                  width={700}
                  height={500}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="section-kicker">LodgeCore Access</div>
              <h2 style={{
                fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,2.8rem)",
                fontWeight: 900, letterSpacing: "-.06em", lineHeight: .92,
                color: "var(--text-primary)", margin: "12px 0 20px",
              }}>
                Where Software Meets<br />
                <span style={{ color: "var(--mint)" }}>the Physical Property.</span>
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-secondary)", marginBottom: 24 }}>
                Most technology companies sell either software or hardware. LodgeCore provides both — plus the installation, integration and ongoing support to make them work together seamlessly.
              </p>
              <div className="feature-list" style={{ marginBottom: 28 }}>
                {[
                  "PMS triggers automatic key issuance on check-in",
                  "Lock access updated in real-time via the cloud",
                  "Room status reflects on housekeeping board instantly",
                  "All access events logged in the unified audit trail",
                ].map((item) => (
                  <div key={item} className="feature-list-item">
                    <div className="feature-list-check" style={{ background: "var(--mint-dim)", color: "var(--mint)" }}>✓</div>
                    <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/access" className="btn btn-primary" style={{ background: "linear-gradient(135deg,#3ef5a0,#00c882)", border: "none", color: "#000", fontWeight: 700 }}>
                  Explore Access →
                </Link>
                <Link href="/hardware" className="btn btn-outline">Browse Hardware</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 5 — SMART ROOM FEATURE ROW
         ══════════════════════════════════════════════════════ */}
      <section className="section-gap">
        <div className="contain">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            <Reveal>
              <div className="section-kicker">LodgeCore Smart</div>
              <h2 style={{
                fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,3.5vw,2.8rem)",
                fontWeight: 900, letterSpacing: "-.06em", lineHeight: .92,
                color: "var(--text-primary)", margin: "12px 0 20px",
              }}>
                Intelligent Rooms.<br />
                <span style={{ color: "#a78bfa" }}>Connected Buildings.</span>
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-secondary)", marginBottom: 24 }}>
                When a guest checks in, the room comes to life automatically. Smart AC, ambient lighting, welcome scenes and energy optimisation — all connected to the LodgeCore PMS.
              </p>
              <div className="feature-list" style={{ marginBottom: 28 }}>
                {[
                  "Room activates automatically on PMS check-in",
                  "AC, lighting and welcome scene set by guest profile",
                  "Energy usage monitored per room, per day",
                  "Smart switches, sensors and curtain motors included",
                ].map((item) => (
                  <div key={item} className="feature-list-item">
                    <div className="feature-list-check" style={{ background: "rgba(167,139,250,.1)", color: "#a78bfa" }}>✓</div>
                    <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link href="/smart" className="btn btn-primary" style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none", fontWeight: 700 }}>
                  Explore Smart →
                </Link>
                <Link href="/smart/smart-hotel" className="btn btn-outline">Smart Hotels</Link>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div style={{
                borderRadius: "var(--radius-xl)", overflow: "hidden",
                boxShadow: "0 24px 80px rgba(0,0,0,.5), 0 0 60px rgba(167,139,250,.10)",
                border: "1px solid rgba(167,139,250,.15)",
              }}>
                <Image
                  src="/smart-room.png"
                  alt="LodgeCore Smart — hotel room with smart AC, lighting and energy management connected to PMS"
                  width={700}
                  height={500}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 6 — GUEST JOURNEY TIMELINE
         ══════════════════════════════════════════════════════ */}
      <section className="section-gap" style={{ background: "var(--surface-1)" }}>
        <div className="contain">
          <Reveal>
            <div style={{ marginBottom: 48 }}>
              <div className="section-kicker">How It All Connects</div>
              <h2 className="section-title">From Reservation to Checkout.</h2>
              <p className="section-body" style={{ maxWidth: 520 }}>
                LodgeCore connects every step of the guest experience — from the first booking to the final key revocation.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="journey-v2">
              <div className="journey-v2-track">
                {JOURNEY.map((step) => (
                  <div key={step.n} className="journey-v2-step">
                    <div className="journey-v2-dot">{step.n}</div>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{step.icon}</div>
                    <div className="journey-v2-title">{step.title}</div>
                    <div className="journey-v2-sub">{step.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 7 — SOLUTIONS GRID
         ══════════════════════════════════════════════════════ */}
      <section className="section-gap">
        <div className="contain">
          <Reveal>
            <div style={{ marginBottom: 48 }}>
              <div className="section-kicker">Built for Every Property</div>
              <h2 className="section-title">Solutions for Every Vertical.</h2>
            </div>
          </Reveal>

          <div className="solutions-grid">
            {SOLUTIONS.map((sol, i) => (
              <Reveal key={sol.href} delay={i * 60}>
                <Link href={sol.href} className="solution-card">
                  <div className="solution-icon">{sol.icon}</div>
                  <div className="solution-name">{sol.name}</div>
                  <div className="solution-tech">
                    {sol.tags.map((t) => <span key={t} className="solution-tag">{t}</span>)}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 8 — SOCIAL PROOF / TESTIMONIALS
         ══════════════════════════════════════════════════════ */}
      <section className="section-gap" style={{ background: "var(--surface-1)" }}>
        <div className="contain">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div className="section-kicker">Customer Stories</div>
              <h2 className="section-title">Trusted by Property Operators.</h2>
              <p className="section-body" style={{ margin: "0 auto" }}>
                From boutique hotels to serviced apartment portfolios — LodgeCore powers real operations.
              </p>
            </div>
          </Reveal>

          <div className="testimonial-grid">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className="testimonial-card">
                  <div className="testimonial-stars">
                    {"★★★★★".slice(0, t.stars)}
                  </div>
                  <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                  <div className="testimonial-author">
                    <div className="testimonial-avatar">{t.initials}</div>
                    <div>
                      <div className="testimonial-name">{t.name}</div>
                      <div className="testimonial-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 9 — FINAL CTA
         ══════════════════════════════════════════════════════ */}
      <section className="cta-v2">
        <div className="contain" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <Reveal>
            <div className="glass-pill" style={{ margin: "0 auto 24px" }}>
              <span className="dot" />
              Get Started Today
            </div>
            <h2 className="cta-v2-headline">
              Build a Smarter Property<br />
              <span style={{ background: "linear-gradient(135deg, #00d4e8, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                With LodgeCore.
              </span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--text-secondary)", maxWidth: 520, margin: "20px auto 40px" }}>
              Whether you need hospitality software, electronic access, smart room automation,
              hardware supply or full technology deployment — LodgeCore has the solution.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/book-demo" className="btn btn-primary btn-lg" style={{ background: "linear-gradient(135deg,#00d4e8,#0099aa)", border: "none", boxShadow: "0 0 40px rgba(0,212,232,.3), 0 8px 24px rgba(0,0,0,.4)" }}>
                Book a Demo →
              </Link>
              <Link href="/hospitality" className="btn btn-outline btn-lg">
                Explore the Platform
              </Link>
              <Link href="/hardware" className="btn btn-outline btn-lg">
                Browse Hardware
              </Link>
            </div>

            {/* Ecosystem badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 48 }}>
              {["PMS", "POS", "Booking Engine", "Hotel Locks", "RFID", "Smart Rooms", "Access Control", "Energy Management", "POS Terminals", "Installation", "Maintenance", "Open API"].map((b) => (
                <span key={b} style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase",
                  padding: "5px 12px", borderRadius: "var(--radius-pill)",
                  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
                  color: "var(--text-muted)",
                }}>{b}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { PublicFooter, PublicHeader } from "@/components/public-shell";

const FAQS = [
  {
    q: "How does LodgeCore pricing work?",
    a: "LodgeCore is configured per organisation through a central control plane. Plans include specific modules and room limits — you only pay for what your property actually uses. Pricing is discussed directly with our team to ensure the right fit.",
  },
  {
    q: "Can I add modules later?",
    a: "Yes. LodgeCore is modular — start with the core PMS and add Operations, Events, Finance and connectivity as your operation grows. Smart Access is included in the PMS/front-desk workflow.",
  },
  {
    q: "Is there a minimum property size?",
    a: "LodgeCore works with properties from boutique guesthouses to large hotel groups. Our team will recommend the right configuration based on your room count, team size and operational complexity.",
  },
  {
    q: "What support is included?",
    a: "All plans include onboarding support and access to the LodgeCore team. Dedicated account management, priority SLAs and on-site support are available on higher tiers.",
  },
  {
    q: "Does LodgeCore work offline?",
    a: "Yes. Critical workflows — check-in, check-out, POS, room status — continue to function during connectivity interruptions. Data syncs automatically when the connection is restored.",
  },
  {
    q: "How long does implementation take?",
    a: "Most properties go live within 2–4 weeks. Your timeline depends on the number of modules, integrations, hardware installation and data migration requirements.",
  },
  {
    q: "Does hardware come with the software?",
    a: "LodgeCore uniquely combines software and hardware. Electronic locks, smart room systems, access control and POS hardware can all be supplied, installed and integrated by the LodgeCore team.",
  },
  {
    q: "Is there a free trial?",
    a: "We offer guided demos and proof-of-concept deployments. Contact the team to arrange a live walkthrough tailored to your property type.",
  },
];

const COMPARE = [
  { feature: "Property Management System",       starter: true,  professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Front Desk & Reservations",        starter: true,  professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Guest Profiles & Folios",          starter: true,  professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Night Audit & Reporting",          starter: true,  professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Smart Access & Offline Front Desk", starter: true, professional: true, business: true, enterprise: true, enterprisePlus: true },
  { feature: "Offline-Ready Workflows",          starter: true,  professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Point of Sale (Outlets)",          starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Housekeeping Module",              starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Maintenance Module",              starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Inventory & Procurement",          starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Booking Engine",                   starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "OTA / Channel Connectivity",       starter: false, professional: false, business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Laundry Operations",               starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Corporate Accounts & City Ledger", starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Events & Banqueting",              starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Finance & Accounting",             starter: false, professional: true,  business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Multi-Property Control Plane",     starter: false, professional: false, business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Group Reporting & Analytics",      starter: false, professional: false, business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Centralised User Management",      starter: false, professional: false, business: true,  enterprise: true,  enterprisePlus: true },
  { feature: "Dedicated Account Manager",        starter: false, professional: false, business: false, enterprise: true,  enterprisePlus: true },
  { feature: "Priority SLA & On-Site Support",   starter: false, professional: false, business: false, enterprise: true,  enterprisePlus: true },
  { feature: "Custom Integrations & Open API",   starter: false, professional: false, business: true,  enterprise: true,  enterprisePlus: true },
];

const LIVE_PLAN_FEATURES: Record<string, string[]> = {
  ESSENTIAL: ["PMS / Front Desk", "Reservations & folios", "Smart Access", "Basic reports", "Offline-ready workflows"],
  PROFESSIONAL: ["Everything in Starter", "Full POS & KDS", "Housekeeping & maintenance", "Inventory & procurement", "Laundry operations", "Corporate accounts, events & halls"],
  BUSINESS: ["Everything in Professional", "Multi-outlet operations", "Advanced accounting", "Channel Manager & OTA", "Multi-property reporting", "API integrations & analytics"],
  ENTERPRISE: ["Everything in Business", "Multi-property control plane", "Centralised user management", "Group reporting & analytics", "Dedicated account manager", "Priority SLA & support"],
  ENTERPRISE_PLUS: ["Everything in Enterprise", "Custom workflows", "Enterprise integrations", "On-site implementation", "Custom SLA", "Executive support"],
};

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  items: { required: boolean; includedQty: number | null; product: { name: string; code: string; prices: { amount: number; currency: string; interval: string }[] } }[];
};

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`faq-item${open ? " open" : ""}`}
      onClick={() => setOpen((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((v) => !v)}
      aria-expanded={open}
    >
      <div className="faq-q">
        <span>{q}</span>
        <span className="faq-toggle" aria-hidden="true">+</span>
      </div>
      <div className="faq-a">{a}</div>
    </div>
  );
}

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
      transform: visible ? "none" : "translateY(24px)",
      transition: `opacity .65s ${delay}ms cubic-bezier(.25,.46,.45,.94), transform .65s ${delay}ms cubic-bezier(.25,.46,.45,.94)`,
    }}>
      {children}
    </div>
  );
}

const STATIC_PLANS = [
  {
    id: "starter",
    name: "Starter",
    description: "The core operating foundation for independent hotels and guesthouses with up to 20 rooms.",
    features: ["PMS / Front Desk", "Reservations & folios", "Guest profiles & folios", "Night audit", "Basic reports", "Offline-ready workflows"],
    featured: false,
    cta: "Get started →",
  },
  {
    id: "professional",
    name: "Professional",
    description: "The full hospitality stack for hotels, resorts and multi-outlet properties.",
    features: ["Everything in Starter", "Full POS & KDS", "Inventory & procurement", "Accounting & cash management", "Events & banqueting", "Booking engine"],
    featured: true,
    cta: "Talk to sales →",
  },
  {
    id: "business",
    name: "Business",
    description: "Advanced operations, finance and connectivity for properties with up to 100 rooms.",
    features: ["Everything in Professional", "Multi-outlet operations", "Advanced accounting", "Payroll", "Channel Manager & OTA", "API integrations & analytics"],
    featured: false,
    cta: "Get started →",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For hotel groups, chains and multi-property portfolios. Centralised control with dedicated support.",
    features: ["Everything in Business", "Multi-property control plane", "Group reporting & analytics", "Centralised user management", "Dedicated account manager", "Priority SLA & support"],
    featured: false,
    cta: "Talk to enterprise →",
  },
  {
    id: "enterprise-plus",
    name: "Enterprise Plus",
    description: "A custom operating model for 250+ room groups and complex portfolios.",
    features: ["Everything in Enterprise", "Custom workflows", "Enterprise integrations", "On-site implementation", "Custom SLA", "Executive support"],
    featured: false,
    cta: "Request a quote →",
  },
];

export default function PricingPage() {
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { plans?: Plan[] } | null) => setPlans(data?.plans ?? []))
      .then(() => setLiveLoaded(true))
      .catch(() => setLiveLoaded(true));
  }, []);

  const displayPlans = plans.length
    ? plans.map((plan, index) => {
        const price = plan.items.filter((item) => item.required).flatMap((item) => item.product.prices).find((item) => item.interval === billingInterval)
          ?? plan.items.filter((item) => item.required).flatMap((item) => item.product.prices).find((item) => item.interval === "month");
        return {
          id: plan.code.toLowerCase(),
          name: plan.name,
          description: plan.description ?? "A modular LodgeCore subscription for hospitality operations.",
          features: LIVE_PLAN_FEATURES[plan.code] ?? plan.items.filter((item) => item.required).map((item) => `${item.product.name}${item.includedQty ? ` · ${item.includedQty} included` : ""}`),
          featured: plan.code === "PROFESSIONAL",
          cta: ["ENTERPRISE", "ENTERPRISE_PLUS"].includes(plan.code) ? "Request a quote →" : "Get started →",
          priceLabel: price ? `${price.currency.toUpperCase()} ${(price.amount / 100).toLocaleString()} / ${price.interval}` : "Pricing on request",
          live: true,
          index,
        };
      })
    : STATIC_PLANS;

  return (
    <main className="site-shell">
      <PublicHeader />

      {/* ── HERO ──────────────────────────────────────────── */}
      <section style={{ paddingTop: 130, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,212,232,.07) 0%, transparent 65%)",
        }} />
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: .02,
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        <div className="contain" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
            letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)",
            marginBottom: 20, padding: "5px 14px",
            border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)",
            background: "var(--accent-dim)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            Transparent Pricing
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 900,
            fontSize: "clamp(2.4rem,5vw,4rem)", letterSpacing: "-.07em",
            lineHeight: .88, color: "var(--text-primary)", marginBottom: 20,
          }}>
            Choose the operating depth<br />
            <span style={{
              background: "linear-gradient(135deg, #00d4e8 0%, #a78bfa 60%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              your property needs.
            </span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 540, margin: "0 auto 36px" }}>
            Every LodgeCore plan is modular — start with the core PMS and expand to POS, bookings, access, smart rooms and hardware as your operation grows.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/book-demo" className="btn btn-primary" style={{ background: "linear-gradient(135deg,#00d4e8,#0099aa)", border: "none", boxShadow: "0 0 28px rgba(0,212,232,.2)" }}>
              Book a demo →
            </Link>
            <Link href="#compare" className="btn btn-outline">Compare plans</Link>
          </div>
        </div>
      </section>

      {/* ── PLAN CARDS ────────────────────────────────────── */}
      <section className="section-gap" style={{ paddingTop: 0 }}>
        <div className="contain">
          <Reveal>
            {plans.length > 0 && <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }} role="group" aria-label="Billing interval">
              {(["month", "year"] as const).map((interval) => <button key={interval} type="button" onClick={() => setBillingInterval(interval)} className={`btn btn-sm ${billingInterval === interval ? "btn-primary" : "btn-outline"}`}>{interval === "month" ? "Monthly" : "Annual · save two months"}</button>)}
            </div>}
            <div className="pricing-grid" style={{ marginBottom: 40 }}>
              {displayPlans.map((plan) => (
                <article key={plan.id} className={`pricing-card${plan.featured ? " featured" : ""}`}>
                  {plan.featured && <div className="pricing-badge">Most popular</div>}
                  <div className="plan-name">{plan.name}</div>
                  <p className="plan-desc">{plan.description}</p>
                  {"priceLabel" in plan && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", marginTop: 10 }}>{String(plan.priceLabel)}</div>}
                  <div className="plan-divider" />
                  <ul className="plan-features" role="list">
                    {plan.features.map((f) => (
                      <li key={f} className="plan-feature">
                        <span className="plan-check">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="plan-cta" style={{ marginTop: 20 }}>
                    <Link
                      href="/book-demo"
                      className={`btn${plan.featured ? " btn-primary" : " btn-outline"}`}
                      style={{ width: "100%", justifyContent: "center", ...(plan.featured ? { background: "linear-gradient(135deg,#00d4e8,#0099aa)", border: "none" } : {}) }}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "center", marginTop: 12 }}>
                    Pricing on request · No long-term lock-in
                  </p>
                </article>
              ))}
            </div>
          </Reveal>

          {/* Hardware add-on banner */}
          <Reveal delay={100}>
            <div style={{
              background: "var(--surface-1)", border: "1px solid rgba(62,245,160,.15)",
              borderRadius: "var(--radius-xl)", padding: "28px 32px",
              display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
              marginBottom: 40,
            }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>🔑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-.04em", marginBottom: 4 }}>
                  Need hardware too?
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Add electronic locks, smart room systems, access control hardware, POS terminals and CCTV — all supplied, installed and integrated by the LodgeCore team.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Link href="/hardware" className="btn btn-outline btn-sm">Browse hardware</Link>
                <Link href="/book-demo" className="btn btn-primary btn-sm" style={{ background: "linear-gradient(135deg,#3ef5a0,#00c882)", border: "none", color: "#000", fontWeight: 700 }}>
                  Get a quote →
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Enterprise CTA */}
          <Reveal delay={150}>
            <div className="platform-cta-panel" style={{ marginBottom: 64 }}>
              <div>
                <div className="section-kicker">Enterprise & Groups</div>
                <h2 className="display-md" style={{ marginTop: 12 }}>Running multiple properties?</h2>
                <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: 480 }}>
                  LodgeCore&apos;s enterprise tier connects multiple properties under a shared control plane — consolidated reporting, centralised user management and group-wide guest profiles.
                </p>
              </div>
              <div className="platform-cta-actions">
                <Link href="/book-demo" className="btn btn-primary btn-lg" style={{ background: "linear-gradient(135deg,#00d4e8,#0099aa)", border: "none" }}>Talk to enterprise sales →</Link>
                <Link href="/integrations" className="btn btn-outline btn-sm">View integrations</Link>
              </div>
            </div>
          </Reveal>

          {/* Feature comparison table */}
          <Reveal>
            <div id="compare" style={{ scrollMarginTop: 80, marginBottom: 64 }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div className="section-kicker">Full Comparison</div>
                <h2 className="display-md" style={{ marginTop: 10 }}>What&apos;s included in each plan</h2>
              </div>
              <div style={{
                border: "1px solid var(--border-card)",
                borderRadius: "var(--radius-xl)",
                overflow: "hidden",
                overflowX: "auto",
                background: "var(--surface-1)",
              }}>
                {/* Table header */}
                <div style={{ display: "grid", minWidth: 900, gridTemplateColumns: "2fr repeat(5, 1fr)", borderBottom: "1px solid var(--border-card)", background: "var(--surface-2)" }}>
                  <div style={{ padding: "14px 20px", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-muted)" }}>Feature</div>
                  {["Starter", "Professional", "Business", "Enterprise", "Enterprise Plus"].map((col, i) => (
                    <div key={col} style={{
                      padding: "14px 20px", textAlign: "center",
                      fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, letterSpacing: "-.03em",
                      color: i === 1 ? "var(--accent)" : "var(--text-primary)",
                      borderLeft: "1px solid var(--border-card)",
                    }}>
                      {col}
                      {i === 1 && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)", opacity: .7, marginTop: 2 }}>Popular</div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {COMPARE.map((row, i) => (
                  <div key={row.feature} style={{
                    display: "grid",
                    minWidth: 900,
                    gridTemplateColumns: "2fr repeat(5, 1fr)",
                    borderBottom: i < COMPARE.length - 1 ? "1px solid var(--border-card)" : "none",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,.012)",
                  }}>
                    <div style={{ padding: "12px 20px", fontSize: 13, color: "var(--text-secondary)" }}>{row.feature}</div>
                    {[row.starter, row.professional, row.business, row.enterprise, row.enterprisePlus].map((has, j) => (
                      <div key={j} style={{
                        padding: "12px 20px", textAlign: "center",
                        borderLeft: "1px solid var(--border-card)",
                        fontSize: 13,
                        color: has ? (j === 1 ? "var(--accent)" : "var(--mint)") : "var(--border)",
                      }}>
                        {has ? "✓" : "—"}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* FAQ */}
          <Reveal>
            <div className="faq-section">
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div className="section-kicker">Common Questions</div>
                <h2 className="display-md" style={{ marginTop: 10 }}>
                  Everything you need to <em>know</em>
                </h2>
              </div>
              <div className="faq-grid">
                {FAQS.map((faq, i) => (
                  <div
                    key={i}
                    className={`faq-item${openFaq === i ? " open" : ""}`}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <div className="faq-q">
                      <span>{faq.q}</span>
                      <span className="faq-toggle" aria-hidden="true">+</span>
                    </div>
                    <div className="faq-a">{faq.a}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="cta-v2">
        <div className="contain" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <Reveal>
            <h2 className="cta-v2-headline">
              Ready to deploy<br />
              <span style={{ background: "linear-gradient(135deg,#00d4e8,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                LodgeCore?
              </span>
            </h2>
            <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 440, margin: "18px auto 36px", lineHeight: 1.7 }}>
              Book a demo and our team will configure a plan tailored to your property, team and technology requirements.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/book-demo" className="btn btn-primary btn-lg" style={{ background: "linear-gradient(135deg,#00d4e8,#0099aa)", border: "none", boxShadow: "0 0 36px rgba(0,212,232,.25)" }}>
                Book a demo →
              </Link>
              <Link href="/hospitality" className="btn btn-outline btn-lg">Explore the platform</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

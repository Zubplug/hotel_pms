"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
type Price = { id: string; amount: number; currency: string; interval: string };
type Product = {
  id: string;
  code: string;
  name: string;
  type: string;
  prices: Price[];
  modules?: { id: string; code: string; name: string; description: string | null }[];
};
type PlanItem = { id: string; required: boolean; includedQty: number | null; product: Product };
type Plan = { id: string; code: string; name: string; description: string | null; metadata: unknown; items: PlanItem[] };

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const money = (amount: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);

const labelify = (value: string) =>
  value.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

function addOnFeatures(product: Product): string[] {
  const code = product.code.toUpperCase();
  const mapped: Record<string, string[]> = {
    ADDON_GROWTH: ["Corporate rate tiers & promotions", "Advanced commercial reports", "Promotional code engine", "Booking pace & performance analytics"],
    ADDON_GUEST_EXPERIENCE: ["Digital check-in & mobile key", "In-app guest messaging", "Service request automation", "Post-stay satisfaction surveys"],
    ADDON_INTELLIGENCE: ["AI-powered revenue management", "Demand forecasting engine", "Overbooking optimisation", "Competitor rate intelligence"],
    ADDON_SMART_ACCESS: ["Electronic lock integration", "Keycard & digital credentials", "Mobile key issuance", "Access activity & audit logs"],
    ADDON_OTA_CHANNEL_MANAGER: ["OTA channel availability sync", "Reservation import automation", "Rate & inventory distribution", "Channel performance reporting"],
    ADDON_BEDS24: ["Beds24 API synchronization", "Automated booking import", "Live availability updates", "Dynamic rate push"],
    ADDON_ENTERPRISE_OPERATIONS: ["Multi-property consolidation", "Advanced role-based access (RBAC)", "Custom operational reports", "Audit logging & compliance"],
  };
  return mapped[code] || product.modules?.map(m => m.name) || ["Extended capability module"];
}

function planFeatures(plan: Plan): { feature: string; included: boolean }[] {
  const code = plan.code.toUpperCase();
  const isStarter = code === "ESSENTIAL" || code === "STARTER";
  const isProfessional = code === "PROFESSIONAL";
  const isBusiness = code === "BUSINESS";
  const isEnterprise = code === "ENTERPRISE" || code === "ENTERPRISE_PLUS";
  const all = [
    { feature: "Front desk & reservations", essential: true, professional: true, enterprise: true },
    { feature: "Tape chart & room assignment", essential: true, professional: true, enterprise: true },
    { feature: "Guest profiles & folios", essential: true, professional: true, enterprise: true },
    { feature: "Check-in & check-out", essential: true, professional: true, enterprise: true },
    { feature: "Night audit engine", essential: true, professional: true, enterprise: true },
    { feature: "Basic occupancy reports", essential: true, professional: true, enterprise: true },
    { feature: "Offline engine", essential: true, professional: true, enterprise: true },
    { feature: "Point of sale (POS + KDS)", essential: false, professional: true, enterprise: true },
    { feature: "Housekeeping management", essential: false, professional: true, enterprise: true },
    { feature: "Maintenance tracking", essential: false, professional: true, enterprise: true },
    { feature: "Inventory & procurement", essential: false, professional: true, enterprise: true },
    { feature: "Events & banqueting", essential: false, professional: true, enterprise: true },
    { feature: "Direct booking engine", essential: false, professional: true, enterprise: true },
    { feature: "Finance & accounting", essential: "Basic", professional: true, enterprise: true },
    { feature: "FIRS tax compliance", essential: false, professional: false, enterprise: true },
    { feature: "Guest loyalty & CRM", essential: false, professional: false, enterprise: true },
    { feature: "Channel Manager & OTA connectivity", essential: false, professional: false, enterprise: true },
    { feature: "AI revenue management", essential: false, professional: false, enterprise: true },
    { feature: "Multi-property dashboard", essential: false, professional: false, enterprise: true },
    { feature: "RBAC & audit controls", essential: false, professional: false, enterprise: true },
    { feature: "Open API & SSO", essential: false, professional: false, enterprise: true },
    { feature: "Dedicated account manager", essential: false, professional: false, enterprise: true },
  ];

  return all.map(f => ({
    feature: f.feature,
    included: isEnterprise ? !!f.enterprise : isBusiness ? (f.feature !== "AI revenue management" ? !!(f.enterprise || f.professional) : false) : isProfessional ? !!f.professional : isStarter ? !!f.essential : false,
  }));
}

function planLimits(plan: Plan): { label: string; value: string }[] {
  if (!plan.metadata || typeof plan.metadata !== "object" || Array.isArray(plan.metadata)) return [];
  return Object.entries(plan.metadata as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => ({ label: labelify(k), value: String(v) === "null" ? "Unlimited" : String(v) }));
}

const PLAN_TIER: Record<string, { badge: string; color: string; dim: string; glow: string; icon: string }> = {
  ESSENTIAL: { badge: "Starter", color: "#00d4e8", dim: "rgba(0,212,232,0.08)", glow: "rgba(0,212,232,0.2)", icon: "◈" },
  STARTER: { badge: "Starter", color: "#00d4e8", dim: "rgba(0,212,232,0.08)", glow: "rgba(0,212,232,0.2)", icon: "◈" },
  PROFESSIONAL: { badge: "Professional", color: "#3ef5a0", dim: "rgba(62,245,160,0.08)", glow: "rgba(62,245,160,0.2)", icon: "⬡" },
  BUSINESS: { badge: "Business", color: "#f5c542", dim: "rgba(245,197,66,0.08)", glow: "rgba(245,197,66,0.2)", icon: "◆" },
  ENTERPRISE: { badge: "Enterprise", color: "#a78bfa", dim: "rgba(167,139,250,0.08)", glow: "rgba(167,139,250,0.2)", icon: "▣" },
  ENTERPRISE_PLUS: { badge: "Enterprise Plus", color: "#f59eeb", dim: "rgba(245,158,235,0.08)", glow: "rgba(245,158,235,0.2)", icon: "✦" },
};

function getPlanTier(code: string) {
  const c = code.toUpperCase();
  return PLAN_TIER[c] || { badge: code, color: "var(--accent)", dim: "var(--accent-dim)", glow: "var(--accent-glow)", icon: "◎" };
}

/* ─────────────────────────────────────────────────────────────
   DETAIL DRAWER
───────────────────────────────────────────────────────────── */
function DetailDrawer({
  details,
  interval,
  onClose,
}: {
  details: { kind: "plan" | "addon"; value: Plan | Product };
  interval: "month" | "year";
  onClose: () => void;
}) {
  const value = details.value;
  const plan = details.kind === "plan" ? value as Plan : null;
  const product = details.kind === "addon" ? value as Product : null;
  const prices = product ? product.prices.filter(p => p.interval === interval) : [];
  const limits = plan ? planLimits(plan) : [];
  const features = plan ? planFeatures(plan) : [];
  const addonFeatures = product ? addOnFeatures(product) : [];
  const tier = plan ? getPlanTier(plan.code) : null;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="sub-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sub-modal-title"
    >
      <div className="sub-modal" onClick={e => e.stopPropagation()}>
        {/* Drawer header */}
        <div className="sub-modal-header">
          <div>
            <div className="sub-section-kicker">{details.kind === "plan" ? "Plan detail" : "Add-on detail"}</div>
            <h2 id="sub-modal-title" className="sub-modal-title">{value.name}</h2>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", marginTop: 4 }}>
              {value.code}
            </div>
          </div>
          <button className="sub-modal-close" onClick={onClose} aria-label="Close details">
            <svg viewBox="0 0 14 14" fill="none" width="14">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="sub-modal-body">
          {/* Plan detail */}
          {plan && (
            <>
              {plan.description && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.75, marginBottom: 24 }}>
                  {plan.description}
                </p>
              )}

              {/* Tier highlights */}
              {tier && (
                <div className="sub-modal-tier-badge" style={{ background: tier.dim, border: `1px solid ${tier.glow}` }}>
                  <span style={{ fontSize: 20 }}>{tier.icon}</span>
                  <div>
                    <div style={{ color: tier.color, fontSize: 13, fontWeight: 700 }}>{tier.badge}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                      {plan.code.toUpperCase() === "ESSENTIAL" || plan.code.toUpperCase() === "STARTER" ? "Up to 20 rooms · Up to 10 users"
                        : plan.code.toUpperCase() === "PROFESSIONAL" ? "Up to 50 rooms · Up to 30 users"
                        : plan.code.toUpperCase() === "BUSINESS" ? "Up to 100 rooms · Up to 60 users"
                        : "Custom room and user limits"}
                    </div>
                  </div>
                </div>
              )}

              {/* Feature list */}
              <DrawerSection title="Platform capabilities">
                <div className="sub-modal-features">
                  {features.map(f => (
                    <div key={f.feature} className="sub-modal-feature-row">
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: f.included ? "rgba(62,245,160,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${f.included ? "rgba(62,245,160,0.3)" : "rgba(255,255,255,0.08)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, color: f.included ? "#3ef5a0" : "rgba(255,255,255,0.2)",
                        flexShrink: 0,
                      }}>
                        {f.included ? "✓" : "—"}
                      </span>
                      <span style={{ color: f.included ? "var(--text-secondary)" : "rgba(255,255,255,0.25)", fontSize: 12 }}>
                        {f.feature}
                      </span>
                    </div>
                  ))}
                </div>
              </DrawerSection>

              {/* Included products */}
              {plan.items.length > 0 && (
                <DrawerSection title="Included catalogue items">
                  {plan.items.map(item => (
                    <div key={item.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 0", borderBottom: "1px solid var(--border)",
                      fontSize: 13, color: "var(--text-secondary)",
                    }}>
                      <span>{item.product.name} {!item.required && <span className="portal-badge badge-inactive" style={{ marginLeft: 6 }}>Optional</span>}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {item.includedQty === null ? "Unlimited" : `${item.includedQty} included`}
                      </span>
                    </div>
                  ))}
                </DrawerSection>
              )}

              {/* Limits */}
              {limits.length > 0 && (
                <DrawerSection title="Plan limits">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {limits.map(lim => (
                      <div key={lim.label} style={{
                        padding: "12px 14px",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.02)",
                      }}>
                        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                          {lim.label}
                        </div>
                        <div style={{ color: "var(--text-primary)", marginTop: 6, fontSize: 14, fontWeight: 700 }}>
                          {lim.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              )}
            </>
          )}

          {/* Add-on detail */}
          {product && (
            <>
              <DrawerSection title="Key capabilities">
                <div className="sub-modal-features">
                  {addonFeatures.map(f => (
                    <div key={f} className="sub-modal-feature-row">
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: "rgba(0,212,232,0.1)", border: "1px solid rgba(0,212,232,0.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, color: "var(--accent)", flexShrink: 0,
                      }}>✓</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </DrawerSection>

              {product.modules && product.modules.length > 0 && (
                <DrawerSection title="Module breakdown">
                  {product.modules.map(mod => (
                    <div key={mod.id} style={{
                      padding: "12px 14px", border: "1px solid var(--border)",
                      borderRadius: 10, marginBottom: 8, background: "rgba(255,255,255,0.02)",
                    }}>
                      <div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{mod.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", marginTop: 2, letterSpacing: "0.1em" }}>{mod.code}</div>
                      {mod.description && (
                        <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>{mod.description}</div>
                      )}
                    </div>
                  ))}
                </DrawerSection>
              )}

              <DrawerSection title="Pricing">
                {prices.length ? (
                  prices.map(p => (
                    <div key={p.id} style={{
                      padding: "14px 16px", border: "1px solid var(--border-strong)",
                      borderRadius: 10, background: "var(--accent-dim)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.04em" }}>
                          {money(p.amount, p.currency.toUpperCase())}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>per {p.interval}</div>
                      </div>
                      <span className="portal-badge badge-normal">{interval === "year" ? "Annual" : "Monthly"}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    Price not yet published for the selected billing interval.
                  </p>
                )}
              </DrawerSection>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
        letterSpacing: "0.18em", textTransform: "uppercase",
        color: "var(--text-muted)", marginBottom: 12,
      }}>{title}</div>
      {children}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   PLAN CARD
───────────────────────────────────────────────────────────── */
function PlanCard({
  plan,
  interval,
  busy,
  onCheckout,
  onDetails,
}: {
  plan: Plan;
  interval: "month" | "year";
  busy: string | null;
  onCheckout: (key: string, priceIds: string[], planId: string) => void;
  onDetails: () => void;
}) {
  const prices = plan.items.filter(item => item.required).map(item => item.product.prices.find(p => p.interval === interval)).filter(Boolean) as Price[];
  const complete = prices.length === plan.items.filter(i => i.required).length;
  const total = prices.reduce((s, p) => s + p.amount, 0);
  const tier = getPlanTier(plan.code);
  const features = planFeatures(plan).filter(f => f.included).slice(0, 6);
  const limits = planLimits(plan);
  const isPopular = plan.code.toUpperCase() === "PROFESSIONAL";

  return (
    <div className={`sub-plan-card${isPopular ? " sub-plan-card--popular" : ""}`} style={{
      "--plan-color": tier.color,
      "--plan-dim": tier.dim,
      "--plan-glow": tier.glow,
    } as React.CSSProperties}>
      {isPopular && (
        <div className="sub-plan-popular-badge">Most popular</div>
      )}

      {/* Card header */}
      <div className="sub-plan-card-header" style={{ borderBottom: `1px solid ${tier.glow}` }}>
        <div className="sub-plan-tier-icon" style={{ background: tier.dim, color: tier.color }}>
          {tier.icon}
        </div>
        <div>
          <div className="sub-plan-name">{plan.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: tier.color, letterSpacing: "0.15em", marginTop: 2 }}>
            {plan.code}
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="sub-plan-price">
        {complete ? (
          <>
            <span className="sub-plan-price-amount" style={{ color: tier.color }}>
              {money(total, prices[0]?.currency.toUpperCase() ?? "NGN")}
            </span>
            <span className="sub-plan-price-interval">/ {interval}</span>
          </>
        ) : (
          <span className="sub-plan-price-pending">Price pending</span>
        )}
        {interval === "year" && complete && (
          <div style={{ fontSize: 10, color: "var(--mint)", marginTop: 4 }}>
            2 months free vs monthly
          </div>
        )}
      </div>

      {/* Description */}
      <p className="sub-plan-desc">
        {plan.description ?? "A LodgeCore subscription package for your hospitality operation."}
      </p>

      {/* Limits chips */}
      {limits.length > 0 && (
        <div className="sub-plan-limits">
          {limits.slice(0, 3).map(lim => (
            <div key={lim.label} className="sub-plan-limit-chip" style={{ borderColor: tier.glow, background: tier.dim }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>{lim.label}:</span>
              <span style={{ color: tier.color, fontSize: 10, fontWeight: 700 }}>{lim.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Features */}
      <div className="sub-plan-features">
        {features.map(f => (
          <div key={f.feature} className="sub-plan-feature">
            <span style={{ color: tier.color, fontSize: 10, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.feature}</span>
          </div>
        ))}
        {planFeatures(plan).filter(f => f.included).length > 6 && (
          <div style={{ fontSize: 11, color: tier.color, marginTop: 4, cursor: "pointer" }} onClick={onDetails}>
            +{planFeatures(plan).filter(f => f.included).length - 6} more capabilities →
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="sub-plan-actions">
        <button className="btn btn-outline btn-sm" onClick={onDetails}>
          Full details
        </button>
        <button
          className="btn btn-sm sub-plan-cta"
          style={{ flex: 1, background: tier.color, color: "#050c14", boxShadow: `0 4px 20px ${tier.glow}` }}
          disabled={busy !== null || !complete}
          onClick={() => onCheckout(`plan-${plan.id}`, prices.map(p => p.id), plan.id)}
        >
          {busy === `plan-${plan.id}` ? "Opening checkout…" : complete ? "Subscribe →" : "Price not available"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADD-ON CARD
───────────────────────────────────────────────────────────── */
function AddOnCard({
  product,
  interval,
  busy,
  onCheckout,
  onDetails,
}: {
  product: Product;
  interval: "month" | "year";
  busy: string | null;
  onCheckout: (key: string, priceIds: string[]) => void;
  onDetails: () => void;
}) {
  const price = product.prices.find(p => p.interval === interval);
  const key = `addon-${product.id}`;
  const features = addOnFeatures(product);

  return (
    <div className="sub-addon-card">
      <div className="sub-addon-header">
        <div className="sub-addon-icon">
          <span style={{ fontSize: 18 }}>
            {product.code.includes("INTELLIGENCE") ? "◈"
              : product.code.includes("GUEST") ? "✦"
              : product.code.includes("ACCESS") ? "⟳"
              : product.code.includes("CHANNEL") ? "◎"
              : "◇"}
          </span>
        </div>
        <div>
          <div className="sub-addon-name">{product.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.12em", marginTop: 2 }}>
            {product.code}
          </div>
        </div>
      </div>

      <div className="sub-addon-features">
        {features.slice(0, 4).map(f => (
          <div key={f} className="sub-addon-feature">
            <span style={{ color: "var(--accent)", fontSize: 9, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{f}</span>
          </div>
        ))}
      </div>

      <div className="sub-addon-price">
        {price ? (
          <>
            <span className="sub-addon-price-amount">{money(price.amount, price.currency.toUpperCase())}</span>
            <span className="sub-addon-price-interval">/ {interval}</span>
          </>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Price pending</span>
        )}
      </div>

      <div className="sub-addon-actions">
        <button className="btn btn-outline btn-sm" onClick={onDetails}>Details</button>
        <button
          className="btn btn-outline btn-sm sub-addon-cta"
          style={{ flex: 1 }}
          disabled={busy !== null || !price}
          onClick={() => price && onCheckout(key, [price.id])}
        >
          {busy === key ? "Opening…" : price ? "Add on →" : "Unavailable"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN CATALOGUE
───────────────────────────────────────────────────────────── */
export default function SubscriptionCatalogue({
  plans,
  addOns,
  properties,
}: {
  plans: Plan[];
  addOns: Product[];
  properties: { id: string; name: string }[];
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{ kind: "plan" | "addon"; value: Plan | Product } | null>(null);

  async function checkout(key: string, priceIds: string[], planId?: string) {
    if (!priceIds.length) return setError("This option does not have a published price for the selected billing interval yet.");
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceIds,
          planId,
          propertyIds: propertyId ? [propertyId] : [],
          successUrl: `${window.location.origin}/portal/subscription?success=true`,
          cancelUrl: `${window.location.origin}/portal/subscription?cancelled=true`,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || typeof payload.url !== "string") throw new Error(payload.error || "Unable to open payment checkout");
      window.location.assign(payload.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open payment checkout");
      setBusy(null);
    }
  }

  return (
    <div>
      {/* Catalogue header */}
      <div className="sub-catalogue-header">
        <div>
          <div className="sub-section-kicker">Self-service catalogue</div>
          <h2 className="sub-section-title">Choose your plan</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 520 }}>
            Select a plan and pay the resulting invoice through Flutterwave. Contact billing support for custom arrangements or multi-property pricing.
          </p>
        </div>
        <div className="sub-catalogue-controls">
          {/* Property scope */}
          <div className="sub-catalogue-control-group">
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Property scope</label>
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              className="sub-scope-select"
              aria-label="Property scope"
            >
              <option value="">Organisation-wide</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Billing interval toggle */}
          <div className="sub-catalogue-control-group">
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Billing interval</label>
            <div className="sub-interval-toggle">
              <button
                className={`sub-interval-btn${interval === "month" ? " active" : ""}`}
                onClick={() => setInterval("month")}
              >
                Monthly
              </button>
              <button
                className={`sub-interval-btn${interval === "year" ? " active" : ""}`}
                onClick={() => setInterval("year")}
              >
                Annual
                <span className="sub-interval-save">Save 17%</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="sub-error-banner portal-card" role="alert" style={{ marginBottom: 20 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#ff5f72" strokeWidth="1.4"/>
            <path d="M8 5v4M8 11v.5" stroke="#ff5f72" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="sub-plans-grid">
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            busy={busy}
            onCheckout={checkout}
            onDetails={() => setDetails({ kind: "plan", value: plan })}
          />
        ))}
      </div>

      {!plans.length && (
        <div className="sub-empty-state" style={{ margin: "32px 0" }}>
          <div className="sub-empty-icon">⬡</div>
          <div className="sub-empty-text">No plans are currently published. Contact the LodgeCore team to configure your subscription.</div>
        </div>
      )}

      {/* Add-ons section */}
      {addOns.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <div className="sub-section-head" style={{ marginBottom: 24 }}>
            <div>
              <div className="sub-section-kicker">Optional expansion</div>
              <h2 className="sub-section-title">Capability add-ons</h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Extend your platform with targeted capability packs. Each add-on is billed separately and scoped to the selected property.
              </p>
            </div>
          </div>

          <div className="sub-addons-grid">
            {addOns.map(product => (
              <AddOnCard
                key={product.id}
                product={product}
                interval={interval}
                busy={busy}
                onCheckout={checkout}
                onDetails={() => setDetails({ kind: "addon", value: product })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {details && (
        <DetailDrawer
          details={details}
          interval={interval}
          onClose={() => setDetails(null)}
        />
      )}
    </div>
  );
}

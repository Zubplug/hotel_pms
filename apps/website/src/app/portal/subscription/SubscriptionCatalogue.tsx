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
  metadata?: unknown;
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
    ADDON_OTA_CHANNEL_MANAGER: ["OTA channel availability sync", "Reservation import automation", "Rate & inventory distribution", "Channel performance reporting"],
    ADDON_BEDS24: ["Beds24 API synchronization", "Automated booking import", "Live availability updates", "Dynamic rate push"],
    ADDON_BOOKING_ENGINE: ["Direct booking website", "Live room availability", "Rate-plan and seasonal pricing", "Guest holds and secure checkout"],
    ADDON_CUSTOM_DOMAIN: ["Branded booking URL", "DNS ownership verification", "Vercel domain attachment", "Automatic SSL provisioning"],
    ADDON_CUSTOM_WEBSITE_DESIGN: ["Bespoke website design", "Brand-led visual direction", "Mobile-responsive booking experience", "HQ design and launch support"],
  };
  return mapped[code] || product.modules?.map(m => m.name) || ["Extended capability module"];
}

function isPropertyScoped(product: Product) {
  return product.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata) && (product.metadata as Record<string, unknown>).unit === "PROPERTY";
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
    .filter(([key, v]) => key.toLowerCase() !== "version" && v !== null && v !== undefined)
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

function planRank(code: string) {
  const ranks: Record<string, number> = { ESSENTIAL: 1, STARTER: 1, PROFESSIONAL: 2, BUSINESS: 3, ENTERPRISE: 4, ENTERPRISE_PLUS: 5 };
  return ranks[code.toUpperCase()] ?? 0;
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
  const prices = product ? product.prices.filter(p => p.interval === interval || p.interval === "one_time") : [];
  const displayPrices = prices.length ? prices : product?.prices ?? [];
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
                {displayPrices.length ? (
                  displayPrices.map(p => (
                    <div key={p.id} style={{
                      padding: "14px 16px", border: "1px solid var(--border-strong)",
                      borderRadius: 10, background: "var(--accent-dim)",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.04em" }}>
                          {money(p.amount, p.currency.toUpperCase())}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.interval === "one_time" ? "one-time service fee" : `per ${p.interval}`}</div>
                      </div>
                      <span className="portal-badge badge-normal">{p.interval === "one_time" ? "One-time" : interval === "year" ? "Annual" : "Monthly"}</span>
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

function PropertyScopeDialog({
  product,
  price,
  properties,
  selectedPropertyIds,
  onToggle,
  onClose,
  onContinue,
}: {
  product: Product;
  price: Price;
  properties: { id: string; name: string }[];
  selectedPropertyIds: string[];
  onToggle: (propertyId: string) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;
  const total = price.amount * selectedPropertyIds.length;

  return createPortal(
    <div className="sub-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="property-scope-title">
      <div className="sub-modal sub-property-scope-modal" onClick={event => event.stopPropagation()}>
        <div className="sub-modal-header">
          <div>
            <div className="sub-section-kicker">Add-on activation</div>
            <h2 id="property-scope-title" className="sub-modal-title">Choose properties</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              Select where {product.name} should be activated. Each selected property is billed separately.
            </p>
          </div>
          <button className="sub-modal-close" onClick={onClose} aria-label="Close property selection">
            <svg viewBox="0 0 14 14" fill="none" width="14"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="sub-modal-body">
          <div className="sub-scope-summary">
            <div>
              <div className="sub-scope-summary-label">Billing frequency</div>
              <div className="sub-scope-summary-value">{price.interval === "year" ? "Annual" : "Monthly"}</div>
            </div>
            <div>
              <div className="sub-scope-summary-label">Rate per property</div>
              <div className="sub-scope-summary-value">{money(price.amount, price.currency.toUpperCase())} / {price.interval}</div>
            </div>
            <div>
              <div className="sub-scope-summary-label">Selected total</div>
              <div className="sub-scope-summary-value sub-scope-summary-total">{money(total, price.currency.toUpperCase())}</div>
            </div>
          </div>

          <div className="sub-scope-dialog-heading">
            <span>Properties</span>
            <span>{selectedPropertyIds.length} of {properties.length} selected</span>
          </div>
          <div className="sub-scope-dialog-list">
            {properties.map(property => (
              <label key={property.id} className={`sub-scope-dialog-option${selectedPropertyIds.includes(property.id) ? " selected" : ""}`}>
                <input type="checkbox" checked={selectedPropertyIds.includes(property.id)} onChange={() => onToggle(property.id)} />
                <span className="sub-scope-dialog-check">{selectedPropertyIds.includes(property.id) ? "✓" : ""}</span>
                <span>{property.name}</span>
              </label>
            ))}
          </div>
          <div className="sub-scope-dialog-note">You will review and complete payment securely through Flutterwave.</div>
          <div className="sub-modal-actions">
            <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-sm sub-plan-cta" disabled={!selectedPropertyIds.length} onClick={onContinue}>
              Continue to payment <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
  currentPlanCode,
  isHighestPlan,
}: {
  plan: Plan;
  interval: "month" | "year";
  busy: string | null;
  onCheckout: (key: string, priceIds: string[], planId: string) => void;
  onDetails: () => void;
  currentPlanCode: string | null;
  isHighestPlan: boolean;
}) {
  // Modules are bundled into a plan and intentionally have no standalone
  // prices. Only the plan product itself contributes to the checkout total.
  const billableItems = plan.items.filter(item => item.required && item.product.code.toUpperCase().startsWith("PLAN_"));
  const prices = billableItems.map(item => item.product.prices.find(p => p.interval === interval)).filter(Boolean) as Price[];
  const complete = prices.length === billableItems.length && billableItems.length > 0;
  const total = prices.reduce((s, p) => s + p.amount, 0);
  const tier = getPlanTier(plan.code);
  const features = planFeatures(plan).filter(f => f.included).slice(0, 6);
  const limits = planLimits(plan);
  const isPopular = plan.code.toUpperCase() === "PROFESSIONAL";
  const isCustomPricing = plan.code.toUpperCase() === "ENTERPRISE_PLUS"
    || (typeof plan.metadata === "object" && plan.metadata !== null && !Array.isArray(plan.metadata)
      && (plan.metadata as Record<string, unknown>).customPricing === true);
  const currentRank = currentPlanCode ? planRank(currentPlanCode) : 0;
  const thisRank = planRank(plan.code);
  const isCurrent = Boolean(currentPlanCode && plan.code.toUpperCase() === currentPlanCode.toUpperCase());
  const isLowerPlan = Boolean(currentRank && thisRank && thisRank < currentRank);
  const isUpgrade = Boolean(currentRank && thisRank > currentRank);
  const planLocked = isCurrent || isLowerPlan;

  return (
    <div className={`sub-plan-card${isPopular ? " sub-plan-card--popular" : ""}${isCurrent ? " sub-plan-card--current" : ""}${isLowerPlan ? " sub-plan-card--disabled" : ""}`} style={{
      "--plan-color": tier.color,
      "--plan-dim": tier.dim,
      "--plan-glow": tier.glow,
    } as React.CSSProperties}>
      {isPopular && (
        <div className="sub-plan-popular-badge">Most popular</div>
      )}
      {(isCurrent || isLowerPlan) && (
        <div className={`sub-plan-state-badge${isCurrent ? " sub-plan-state-badge--current" : ""}`}>
          {isCurrent ? "Current plan" : "Lower tier"}
        </div>
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
        {isCustomPricing ? (
          <div>
            <span className="sub-plan-price-pending">Custom pricing</span>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Contact support for a tailored quote</div>
          </div>
        ) : complete ? (
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
        {isCustomPricing ? (
          <a
            className="btn btn-sm sub-plan-cta"
            style={{ flex: 1, background: tier.color, color: "#050c14", boxShadow: `0 4px 20px ${tier.glow}`, textAlign: "center" }}
            href="/portal/support"
          >
            Contact support →
          </a>
        ) : (
          <button
            className="btn btn-sm sub-plan-cta"
            style={{ flex: 1, background: planLocked ? "rgba(255,255,255,0.06)" : tier.color, color: planLocked ? "var(--text-muted)" : "#050c14", boxShadow: planLocked ? "none" : `0 4px 20px ${tier.glow}` }}
            disabled={busy !== null || !complete || planLocked}
            onClick={() => onCheckout(`plan-${plan.id}`, prices.map(p => p.id), plan.id)}
          >
            {busy === `plan-${plan.id}` ? "Opening checkout…" : !complete ? "Price not available" : isCurrent ? "Current plan" : isLowerPlan ? "Unavailable" : isUpgrade ? (isHighestPlan ? "Upgrade →" : "Update plan →") : "Subscribe →"}
          </button>
        )}
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
  canSubscribe,
  scopeReady,
  isActive,
}: {
  product: Product;
  interval: "month" | "year";
  busy: string | null;
  onCheckout: (key: string, priceIds: string[]) => void;
  onDetails: () => void;
  canSubscribe: boolean;
  scopeReady: boolean;
  isActive: boolean;
}) {
  const price = product.prices.find(p => p.interval === interval) ?? product.prices.find(p => p.interval === "one_time") ?? product.prices[0];
  const isPropertyPriced = product.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata) && (product.metadata as Record<string, unknown>).unit === "PROPERTY";
  const key = `addon-${product.id}`;
  const features = addOnFeatures(product);

  return (
    <div className={`sub-addon-card${isActive ? " sub-addon-card--active" : ""}`}>
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
          {isActive && <span className="sub-addon-status">Active</span>}
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
            <span className="sub-addon-price-interval">{price.interval === "one_time" ? "one-time" : isPropertyPriced ? `/ property / ${price.interval}` : `/ ${price.interval}`}</span>
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
          disabled={busy !== null || !price || !canSubscribe || !scopeReady || isActive}
          onClick={() => price && onCheckout(key, [price.id])}
        >
          {busy === key ? "Opening…" : isActive ? "Active add-on" : !canSubscribe ? "Base plan required" : !scopeReady ? "No property available" : price ? "Add on →" : "Unavailable"}
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
  activeAddonCodes,
  activeAddonPropertyIds,
  currentPlanCode,
  hasActiveBaseSubscription,
}: {
  plans: Plan[];
  addOns: Product[];
  properties: { id: string; name: string }[];
  activeAddonCodes: string[];
  activeAddonPropertyIds: Record<string, string[]>;
  currentPlanCode: string | null;
  hasActiveBaseSubscription: boolean;
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{ kind: "plan" | "addon"; value: Plan | Product } | null>(null);
  const [scopeProduct, setScopeProduct] = useState<{ product: Product; key: string; priceIds: string[] } | null>(null);

  async function checkout(key: string, priceIds: string[], planId?: string, requestedPropertyIds = selectedPropertyIds.slice(0, 1)) {
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
          propertyIds: requestedPropertyIds,
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

  function startAddonCheckout(product: Product, key: string, priceIds: string[]) {
    const propertyPriced = isPropertyScoped(product);
    if (!propertyPriced) return checkout(key, priceIds, undefined, []);
    if (!properties.length) return setError("Add a property before purchasing this add-on.");
    if (properties.length === 1) return checkout(key, priceIds, undefined, [properties[0].id]);
    const activeProperties = new Set(activeAddonPropertyIds[product.code] ?? []);
    const availableProperties = properties.filter(property => !activeProperties.has(property.id));
    setSelectedPropertyIds((availableProperties.length ? availableProperties : properties).map(property => property.id));
    setScopeProduct({ product, key, priceIds });
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
            currentPlanCode={currentPlanCode}
            isHighestPlan={planRank(plan.code) === Math.max(...plans.map(candidate => planRank(candidate.code)))}
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

          {!hasActiveBaseSubscription && (
            <div className="sub-error-banner portal-card" role="status" style={{ marginBottom: 20 }}>
              Select and activate a base plan before purchasing capability add-ons. Add-ons cannot be subscribed to on their own.
            </div>
          )}

          <div className="sub-addons-grid">
            {addOns.map(product => (
              <AddOnCard
                key={product.id}
                product={product}
                interval={interval}
                busy={busy}
                onCheckout={(key, priceIds) => startAddonCheckout(product, key, priceIds)}
                canSubscribe={hasActiveBaseSubscription}
                scopeReady={!isPropertyScoped(product) || properties.length > 0}
                isActive={isPropertyScoped(product) ? properties.length > 0 && properties.every(property => (activeAddonPropertyIds[product.code] ?? []).includes(property.id)) : activeAddonCodes.includes(product.code)}
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
      {scopeProduct && (
        <PropertyScopeDialog
          product={scopeProduct.product}
          price={scopeProduct.product.prices.find(price => price.id === scopeProduct.priceIds[0]) ?? scopeProduct.product.prices[0]!}
          properties={properties}
          selectedPropertyIds={selectedPropertyIds}
          onToggle={propertyId => setSelectedPropertyIds(current => current.includes(propertyId) ? current.filter(id => id !== propertyId) : [...current, propertyId])}
          onClose={() => setScopeProduct(null)}
          onContinue={() => { const selection = scopeProduct; setScopeProduct(null); void checkout(selection.key, selection.priceIds, undefined, selectedPropertyIds); }}
        />
      )}
      <style>{`.sub-property-scope-modal{max-width:520px}.sub-scope-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px;border:1px solid var(--border);border-radius:12px;background:rgba(255,255,255,.025);margin-bottom:24px}.sub-scope-summary-label{font:10px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}.sub-scope-summary-value{margin-top:6px;color:var(--text-primary);font-size:13px;font-weight:650}.sub-scope-summary-total{color:var(--accent)}.sub-scope-dialog-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:var(--text-secondary);font-size:12px;font-weight:650}.sub-scope-dialog-heading span+span{color:var(--text-muted);font:10px var(--font-mono)}.sub-scope-dialog-list{display:grid;gap:8px;max-height:260px;overflow:auto}.sub-scope-dialog-option{display:flex;align-items:center;gap:10px;padding:13px 14px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.018);color:var(--text-secondary);font-size:13px;cursor:pointer;transition:border-color .2s,background .2s}.sub-scope-dialog-option:hover,.sub-scope-dialog-option.selected{border-color:rgba(0,212,232,.42);background:rgba(0,212,232,.07)}.sub-scope-dialog-option input{position:absolute;opacity:0;pointer-events:none}.sub-scope-dialog-check{display:flex;align-items:center;justify-content:center;width:18px;height:18px;border:1px solid rgba(255,255,255,.18);border-radius:5px;color:#06121c;background:transparent;font-size:11px;font-weight:800}.sub-scope-dialog-option.selected .sub-scope-dialog-check{border-color:var(--accent);background:var(--accent)}.sub-scope-dialog-note{margin-top:16px;color:var(--text-muted);font-size:11px;line-height:1.5}.sub-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px;padding-top:18px;border-top:1px solid var(--border)}@media (max-width:600px){.sub-scope-summary{grid-template-columns:1fr}.sub-modal-actions{flex-direction:column-reverse}.sub-modal-actions .btn{width:100%}}`}</style>
    </div>
  );
}

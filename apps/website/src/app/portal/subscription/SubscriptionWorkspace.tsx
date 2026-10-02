"use client";

import Link from "next/link";
import { useState } from "react";
import SubscriptionCatalogue from "./SubscriptionCatalogue";
import {
  AnimatedCounter,
  SubscriptionHealthGauge,
  InvoiceTrendChart,
  ModuleCoverageBar,
  PropertyReadinessGrid,
  BillingHealthDonut,
  SpendForecastBars,
  RenewalProgressBar,
} from "./SubscriptionCharts";

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
type SubscriptionData = {
  status: string;
  planName: string;
  planCode: string | null;
  periodStart: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  items: { name: string; code: string; includedQty: number | null; required: boolean }[];
} | null;

type Invoice = {
  id: string;
  status: string;
  currency: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  targetGoLiveAt: string | null;
  createdAt: string;
};

type Entitlement = {
  id: string;
  name: string;
  code: string;
  propertyName: string;
  expiresAt: string | null;
};

type Property = {
  id: string;
  name: string;
  isActive: boolean;
  ready: boolean;
};

type Props = {
  data: {
    subscription: SubscriptionData;
    entitlements: Entitlement[];
    properties: Property[];
    invoices: Invoice[];
    projects: Project[];
    latestInvoiceStatus: string | null;
    metrics: {
      activeProperties: number;
      totalProperties: number;
      readyProperties: number;
      activeEntitlements: number;
      openProjects: number;
      invoiceDue: number;
      failedInvoices: number;
    };
  };
  plans: any[];
  addOns: any[];
  checkoutProperties: { id: string; name: string }[];
};

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(value / 100);

const statusClass = (status: string) => {
  const v = status.toUpperCase();
  if (v === "ACTIVE" || v === "PAID" || v === "COMPLETED") return "badge-active";
  if (["PAST_DUE", "FAILED", "UNCOLLECTIBLE"].includes(v)) return "badge-urgent";
  if (v === "TRIALING") return "badge-normal";
  return "badge-pending";
};

const projectStatusInfo = (status: string) => {
  const v = status.toUpperCase();
  if (v === "COMPLETED") return { class: "badge-active", icon: "✓", pct: 100 };
  if (v === "IN_PROGRESS" || v === "ACTIVE") return { class: "badge-normal", icon: "◎", pct: 60 };
  if (v === "PLANNING") return { class: "badge-pending", icon: "◇", pct: 20 };
  if (v === "CANCELLED") return { class: "badge-inactive", icon: "✕", pct: 0 };
  return { class: "badge-pending", icon: "◉", pct: 40 };
};

/* ─────────────────────────────────────────────────────────────
   KPI CARD
───────────────────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  tone,
  icon,
  numeric,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "accent" | "mint" | "violet" | "amber" | "red" | "neutral";
  icon: string;
  numeric?: number;
}) {
  const colors: Record<string, string> = {
    accent: "var(--accent)",
    mint: "var(--mint)",
    violet: "#a78bfa",
    amber: "var(--amber)",
    red: "var(--red)",
    neutral: "var(--text-secondary)",
  };
  const dimColors: Record<string, string> = {
    accent: "rgba(0,212,232,0.08)",
    mint: "rgba(62,245,160,0.08)",
    violet: "rgba(167,139,250,0.08)",
    amber: "rgba(255,190,90,0.08)",
    red: "rgba(255,95,114,0.08)",
    neutral: "rgba(255,255,255,0.04)",
  };
  return (
    <div className="sub-kpi-card">
      <div className="sub-kpi-icon" style={{ background: dimColors[tone], color: colors[tone] }}>
        {icon}
      </div>
      <div className="sub-kpi-body">
        <div className="sub-kpi-label">{label}</div>
        <div className="sub-kpi-value" style={{ color: colors[tone] }}>
          {numeric !== undefined ? (
            <AnimatedCounter value={numeric} />
          ) : (
            value
          )}
        </div>
        <div className="sub-kpi-sub">{sub}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────────────────────── */
function SectionHeader({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sub-section-head">
      <div>
        <div className="sub-section-kicker">{kicker}</div>
        <h2 className="sub-section-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   INVOICE STATUS ICON
───────────────────────────────────────────────────────────── */
function InvoiceStatusPip({ status }: { status: string }) {
  const v = status.toUpperCase();
  const color =
    v === "PAID" || v === "ACTIVE" ? "#3ef5a0"
    : ["FAILED", "UNCOLLECTIBLE", "PAST_DUE"].includes(v) ? "#ff5f72"
    : "#ffbe5a";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      color,
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>
      <span style={{
        width: 6, height: 6,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}`,
        flexShrink: 0,
      }} />
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN WORKSPACE COMPONENT
───────────────────────────────────────────────────────────── */
export default function SubscriptionWorkspace({ data, plans, addOns, checkoutProperties }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "modules" | "billing" | "catalogue">("overview");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const daysRemaining = data.subscription
    ? Math.max(0, Math.ceil((new Date(data.subscription.periodEnd).getTime() - Date.now()) / 86400000))
    : 0;
  const totalDays = data.subscription
    ? Math.max(1, Math.ceil((new Date(data.subscription.periodEnd).getTime() - new Date(data.subscription.periodStart).getTime()) / 86400000))
    : 30;
  const billingCurrency = data.invoices[0]?.currency || "NGN";
  const totalSpend = data.invoices.reduce((s, inv) => s + inv.amountPaid, 0);
  const paidInvoices = data.invoices.filter(inv => inv.amountDue === 0).length;

  async function requestBillingSupport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Billing support is currently unavailable");
      if (payload.url) window.location.assign(payload.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing support is currently unavailable");
      setBusy(false);
    }
  }

  /* ─── HERO HEADER ─────────────────────────────────────── */
  return (
    <div className="sub-workspace">

      {/* ── HERO BANNER ─────────────────────────────────── */}
      <div className="sub-hero">
        <div className="sub-hero-mesh" aria-hidden="true">
          <div className="sub-mesh-orb sub-mesh-1" />
          <div className="sub-mesh-orb sub-mesh-2" />
        </div>

        <div className="sub-hero-left">
          <div className="sub-hero-kicker">
            <span className="sub-kicker-dot" />
            Customer workspace · commercial control
          </div>
          <h1 className="sub-hero-title">Subscription <em>Dashboard</em></h1>
          <p className="sub-hero-sub">
            Your plan, enabled modules, property scope and billing health — all in one place.
          </p>
          <div className="sub-hero-actions">
            <Link href="/portal/billing" className="btn btn-outline btn-sm">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1 6h12" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Open billing
            </Link>
            <button className="btn btn-primary btn-sm" onClick={requestBillingSupport} disabled={busy}>
              {busy ? "Contacting team…" : "Billing support →"}
            </button>
          </div>
        </div>

        <div className="sub-hero-right">
          {data.subscription ? (
            <SubscriptionHealthGauge
              daysRemaining={daysRemaining}
              totalDays={totalDays}
              status={data.subscription.status}
              planName={data.subscription.planName}
            />
          ) : (
            <div className="sub-gauge-empty">
              <div className="sub-gauge-empty-icon">◈</div>
              <div className="sub-gauge-empty-text">No active plan</div>
            </div>
          )}
          {data.subscription && (
            <div className="sub-hero-plan-meta">
              <span className={`portal-badge ${statusClass(data.subscription.status)}`}>
                {data.subscription.status}
              </span>
              {data.subscription.cancelAtPeriodEnd && (
                <span className="portal-badge badge-urgent">Cancelling</span>
              )}
              {data.subscription.trialEndsAt && (
                <span className="portal-badge badge-pending">Trial</span>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="portal-card sub-error-banner" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#ff5f72" strokeWidth="1.4"/>
            <path d="M8 5v4M8 11v.5" stroke="#ff5f72" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── PAST DUE ALERT ─────────────────────────────── */}
      {data.subscription?.status === "PAST_DUE" && (
        <div className="sub-alert-banner">
          <div className="sub-alert-icon">⚠</div>
          <div className="sub-alert-body">
            <strong>Payment past due.</strong> Your subscription access may be interrupted. Please settle the outstanding invoice immediately.
          </div>
          <button className="btn btn-sm" style={{ background: "#ff5f72", color: "#fff", border: "none" }} onClick={requestBillingSupport} disabled={busy}>
            Resolve now →
          </button>
        </div>
      )}

      {/* ── KPI STRIP ──────────────────────────────────── */}
      <section className="sub-kpi-strip">
        <KpiCard
          label="Current Plan"
          value={data.subscription?.planName ?? "No plan"}
          sub={data.subscription ? `Code: ${data.subscription.planCode ?? "CUSTOM"}` : "Choose a plan to begin"}
          tone="accent"
          icon="⬡"
        />
        <KpiCard
          label="Active Properties"
          value={`${data.metrics.activeProperties}/${data.metrics.totalProperties}`}
          sub={`${data.metrics.readyProperties} lifecycle-ready`}
          tone="mint"
          icon="🏨"
          numeric={data.metrics.activeProperties}
        />
        <KpiCard
          label="Module Entitlements"
          value={String(data.metrics.activeEntitlements)}
          sub="Active access grants"
          tone="violet"
          icon="◈"
          numeric={data.metrics.activeEntitlements}
        />
        <KpiCard
          label="Days Remaining"
          value={String(daysRemaining)}
          sub={data.subscription ? `Period ends ${new Date(data.subscription.periodEnd).toLocaleDateString("en-GB")}` : "No active period"}
          tone={daysRemaining < 14 ? "amber" : "mint"}
          icon="◎"
          numeric={daysRemaining}
        />
        <KpiCard
          label="Billing Health"
          value={data.metrics.failedInvoices ? `${data.metrics.failedInvoices} issue${data.metrics.failedInvoices > 1 ? "s" : ""}` : "Clear"}
          sub={data.metrics.invoiceDue ? `${money(data.metrics.invoiceDue, billingCurrency)} outstanding` : "No open balance"}
          tone={data.metrics.failedInvoices ? "red" : "mint"}
          icon="◇"
        />
        <KpiCard
          label="Total Spend"
          value={money(totalSpend, billingCurrency)}
          sub={`${paidInvoices} of ${data.invoices.length} invoices paid`}
          tone="neutral"
          icon="◎"
        />
      </section>

      {/* ── TAB NAV ────────────────────────────────────── */}
      <div className="sub-tab-nav" role="tablist">
        {([
          { id: "overview", label: "Overview", icon: "◈" },
          { id: "modules", label: "Modules & Properties", icon: "⬡" },
          { id: "billing", label: "Billing & Invoices", icon: "◇" },
          { id: "catalogue", label: "Plans & Add-ons", icon: "◎" },
        ] as const).map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`sub-tab-btn${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="sub-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
          TAB: OVERVIEW
      ═══════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="sub-tab-panel">

          {/* Subscription status card */}
          <div className="sub-card sub-status-card">
            <div className="sub-card-accent-bar" style={{
              background: data.subscription?.status === "PAST_DUE"
                ? "linear-gradient(90deg, #ff5f72, #ff8fa0)"
                : "linear-gradient(90deg, var(--accent), var(--mint))"
            }} />
            <div className="sub-status-top">
              <div>
                <div className="sub-section-kicker">Subscription status</div>
                <h2 className="sub-status-plan">{data.subscription?.planName ?? "No active plan"}</h2>
                {data.subscription && (
                  <p className="sub-status-desc">
                    {data.subscription.planCode ?? "Custom"} plan · {data.metrics.activeProperties} {data.metrics.activeProperties === 1 ? "property" : "properties"} in scope
                  </p>
                )}
              </div>
              {data.subscription && (
                <div className="sub-status-period-block">
                  <div className="sub-status-period-label">Period ends</div>
                  <div className="sub-status-period-date">
                    {new Date(data.subscription.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="sub-status-period-days" style={{ color: daysRemaining < 14 ? "var(--amber)" : "var(--mint)" }}>
                    {daysRemaining} days remaining
                  </div>
                </div>
              )}
            </div>

            {data.subscription && (
              <>
                <RenewalProgressBar
                  periodStart={data.subscription.periodStart}
                  periodEnd={data.subscription.periodEnd}
                />
                <div className="sub-status-meta-row">
                  <div className="sub-status-meta-item">
                    <div className="sub-status-meta-label">Plan code</div>
                    <div className="sub-status-meta-value" style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {data.subscription.planCode ?? "CUSTOM"}
                    </div>
                  </div>
                  <div className="sub-status-meta-item">
                    <div className="sub-status-meta-label">Renewal</div>
                    <div className="sub-status-meta-value">
                      {data.subscription.cancelAtPeriodEnd ? "⚠ Scheduled to cancel" : "Managed by LodgeCore billing"}
                    </div>
                  </div>
                  <div className="sub-status-meta-item">
                    <div className="sub-status-meta-label">Included items</div>
                    <div className="sub-status-meta-value">{data.subscription.items.length} products</div>
                  </div>
                  <div className="sub-status-meta-item">
                    <div className="sub-status-meta-label">Active entitlements</div>
                    <div className="sub-status-meta-value" style={{ color: "var(--mint)" }}>{data.metrics.activeEntitlements}</div>
                  </div>
                </div>

                {/* Plan items list */}
                {data.subscription.items.length > 0 && (
                  <div className="sub-plan-items">
                    {data.subscription.items.map((item, i) => (
                      <div key={i} className="sub-plan-item">
                        <div className="sub-plan-item-dot" style={{ background: item.required ? "var(--accent)" : "rgba(255,255,255,0.2)" }} />
                        <span className="sub-plan-item-name">{item.name}</span>
                        {!item.required && <span className="portal-badge badge-inactive">Optional</span>}
                        <span className="sub-plan-item-qty">
                          {item.includedQty === null ? "Unlimited" : `${item.includedQty} included`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {!data.subscription && (
              <div className="sub-no-plan-cta">
                <div className="sub-no-plan-icon">⬡</div>
                <div className="sub-no-plan-text">No subscription plan selected yet. Browse available plans below to get started.</div>
                <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("catalogue")}>
                  View plans →
                </button>
              </div>
            )}
          </div>

          {/* 2-col: Billing health + Invoice trend */}
          <div className="sub-grid-2">
            {/* Billing health */}
            <div className="sub-card">
              <SectionHeader kicker="Financial health" title="Billing overview" />
              <div className="sub-billing-health-wrap">
                <BillingHealthDonut
                  paid={paidInvoices}
                  due={data.invoices.filter(i => i.amountDue > 0).length}
                  failed={data.metrics.failedInvoices}
                />
                <div className="sub-billing-health-stats">
                  <div className="sub-billing-stat">
                    <div className="sub-billing-stat-label">Total invoiced</div>
                    <div className="sub-billing-stat-value">{money(data.invoices.reduce((s, i) => s + i.total, 0), billingCurrency)}</div>
                  </div>
                  <div className="sub-billing-stat">
                    <div className="sub-billing-stat-label">Total paid</div>
                    <div className="sub-billing-stat-value" style={{ color: "var(--mint)" }}>{money(totalSpend, billingCurrency)}</div>
                  </div>
                  <div className="sub-billing-stat">
                    <div className="sub-billing-stat-label">Outstanding</div>
                    <div className="sub-billing-stat-value" style={{ color: data.metrics.invoiceDue > 0 ? "var(--amber)" : "var(--text-muted)" }}>
                      {money(data.metrics.invoiceDue, billingCurrency)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spend trend */}
            <div className="sub-card">
              <SectionHeader kicker="Spend analytics" title="Invoice trend" />
              <InvoiceTrendChart invoices={data.invoices} currency={billingCurrency} />
              <div style={{ marginTop: 16 }}>
                <SpendForecastBars invoices={data.invoices} currency={billingCurrency} />
              </div>
            </div>
          </div>

          {/* Implementation projects */}
          {data.projects.length > 0 && (
            <div className="sub-card">
              <SectionHeader
                kicker="Onboarding pipeline"
                title="Implementation projects"
                action={
                  <Link href="/portal/implementation" className="btn btn-outline btn-sm">
                    View all →
                  </Link>
                }
              />
              <div className="sub-projects-list">
                {data.projects.map((project, i) => {
                  const info = projectStatusInfo(project.status);
                  return (
                    <div key={project.id} className="sub-project-item">
                      <div className="sub-project-icon" style={{ animationDelay: `${i * 80}ms` }}>
                        <span className={`portal-badge ${info.class}`}>{info.icon}</span>
                      </div>
                      <div className="sub-project-body">
                        <div className="sub-project-name">{project.name}</div>
                        <div className="sub-project-meta">
                          {project.targetGoLiveAt
                            ? `Go-live: ${new Date(project.targetGoLiveAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                            : `Created ${new Date(project.createdAt).toLocaleDateString("en-GB")}`}
                        </div>
                        <div className="sub-project-bar-track">
                          <div
                            className="sub-project-bar-fill"
                            style={{ width: `${info.pct}%`, background: info.class === "badge-active" ? "var(--mint)" : "var(--accent)" }}
                          />
                        </div>
                      </div>
                      <div className="sub-project-pct" style={{ color: info.class === "badge-active" ? "var(--mint)" : "var(--text-muted)" }}>
                        {info.pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: MODULES & PROPERTIES
      ═══════════════════════════════════════════════════ */}
      {activeTab === "modules" && (
        <div className="sub-tab-panel">
          {/* Module coverage */}
          <div className="sub-card">
            <SectionHeader kicker="Platform coverage" title="Module activation status" />
            <p className="sub-card-desc">Capabilities currently enabled for your organisation based on active entitlements.</p>
            <ModuleCoverageBar entitlements={data.entitlements} />
          </div>

          {/* 2-col: Entitlement table + Property readiness */}
          <div className="sub-grid-2">
            <div className="sub-card">
              <SectionHeader kicker="Access grants" title="Active entitlements" />
              {data.entitlements.length ? (
                <div className="sub-entitlement-list">
                  {data.entitlements.map((ent, i) => (
                    <div key={ent.id} className="sub-entitlement-row" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="sub-entitlement-dot" />
                      <div className="sub-entitlement-body">
                        <div className="sub-entitlement-name">{ent.name}</div>
                        <div className="sub-entitlement-scope">
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)" }}>{ent.code}</span>
                          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ent.propertyName}</span>
                        </div>
                      </div>
                      <div className="sub-entitlement-status">
                        {ent.expiresAt && new Date(ent.expiresAt) < new Date()
                          ? <span className="portal-badge badge-urgent">Expired</span>
                          : <span className="portal-badge badge-active">Active</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sub-empty-state">
                  <div className="sub-empty-icon">◈</div>
                  <div className="sub-empty-text">No active entitlements yet. Subscribe to a plan to activate modules.</div>
                </div>
              )}
            </div>

            <div className="sub-card">
              <SectionHeader kicker="Property scope" title="Readiness status" />
              <PropertyReadinessGrid properties={data.properties} />
              <div className="sub-property-legend">
                {[
                  { color: "#3ef5a0", label: "Live & ready" },
                  { color: "#ffbe5a", label: "Setting up" },
                  { color: "#4e6678", label: "Inactive" },
                ].map(item => (
                  <div key={item.label} className="sub-legend-item">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Property full table */}
          <div className="sub-card">
            <SectionHeader
              kicker="Property management"
              title="All properties"
              action={
                <Link href="/portal/properties" className="btn btn-outline btn-sm">
                  Manage properties →
                </Link>
              }
            />
            <div className="portal-table-wrap" style={{ border: "none" }}>
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Status</th>
                    <th>Lifecycle</th>
                    <th>Entitlements</th>
                  </tr>
                </thead>
                <tbody>
                  {data.properties.map(prop => {
                    const propEnts = data.entitlements.filter(e => e.propertyName === prop.name);
                    return (
                      <tr key={prop.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 6,
                              background: prop.isActive ? "var(--accent-dim)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${prop.isActive ? "var(--border-strong)" : "var(--border)"}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12,
                            }}>🏨</div>
                            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{prop.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`portal-badge ${prop.isActive ? "badge-active" : "badge-inactive"}`}>
                            {prop.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <span className={`portal-badge ${prop.ready ? "badge-active" : prop.isActive ? "badge-pending" : "badge-inactive"}`}>
                            {prop.ready ? "Live" : prop.isActive ? "Setting up" : "Not configured"}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: propEnts.length ? "var(--mint)" : "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>
                            {propEnts.length > 0 ? propEnts.length : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!data.properties.length && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: 28 }}>
                        No properties registered yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: BILLING & INVOICES
      ═══════════════════════════════════════════════════ */}
      {activeTab === "billing" && (
        <div className="sub-tab-panel">

          {/* Billing summary cards */}
          <div className="sub-grid-3">
            <div className="sub-mini-stat">
              <div className="sub-mini-stat-label">Total invoiced</div>
              <div className="sub-mini-stat-value">
                {money(data.invoices.reduce((s, i) => s + i.total, 0), billingCurrency)}
              </div>
              <div className="sub-mini-stat-sub">{data.invoices.length} invoices total</div>
            </div>
            <div className="sub-mini-stat" style={{ borderColor: data.metrics.invoiceDue > 0 ? "rgba(255,190,90,0.3)" : "var(--border-card)" }}>
              <div className="sub-mini-stat-label">Outstanding balance</div>
              <div className="sub-mini-stat-value" style={{ color: data.metrics.invoiceDue > 0 ? "var(--amber)" : "var(--mint)" }}>
                {money(data.metrics.invoiceDue, billingCurrency)}
              </div>
              <div className="sub-mini-stat-sub">
                {data.metrics.invoiceDue > 0 ? "Action required" : "All clear"}
              </div>
            </div>
            <div className="sub-mini-stat">
              <div className="sub-mini-stat-label">Total paid</div>
              <div className="sub-mini-stat-value" style={{ color: "var(--mint)" }}>
                {money(totalSpend, billingCurrency)}
              </div>
              <div className="sub-mini-stat-sub">{paidInvoices} paid invoices</div>
            </div>
          </div>

          {/* Spend chart */}
          <div className="sub-card">
            <SectionHeader kicker="Spend analytics" title="Monthly billing history" />
            <InvoiceTrendChart invoices={data.invoices} currency={billingCurrency} />
            <div style={{ marginTop: 20 }}>
              <SpendForecastBars invoices={data.invoices} currency={billingCurrency} />
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ width: 10, height: 10, background: "var(--mint)", borderRadius: 2, display: "inline-block" }} />
                Paid amount
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                <span style={{ width: 10, height: 10, background: "var(--amber)", borderRadius: 2, display: "inline-block" }} />
                Outstanding
              </div>
            </div>
          </div>

          {/* Invoice table */}
          <div className="sub-card">
            <SectionHeader
              kicker="Financial record"
              title="Invoice history"
              action={
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={requestBillingSupport} disabled={busy}>
                    {busy ? "Opening…" : "Billing portal →"}
                  </button>
                </div>
              }
            />
            {data.invoices.length ? (
              <div className="sub-invoice-list">
                {data.invoices.map((invoice, i) => (
                  <div key={invoice.id} className="sub-invoice-row">
                    <div className="sub-invoice-main" onClick={() => setExpandedInvoice(expandedInvoice === invoice.id ? null : invoice.id)}>
                      <div className="sub-invoice-date">
                        <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 13 }}>
                          {new Date(invoice.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                        {invoice.periodEnd && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            Period: {invoice.periodEnd ? new Date(invoice.periodEnd).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : "—"}
                          </div>
                        )}
                      </div>
                      <InvoiceStatusPip status={invoice.status} />
                      <div className="sub-invoice-amounts">
                        <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 14 }}>
                          {money(invoice.total, invoice.currency)}
                        </div>
                        {invoice.amountDue > 0 && (
                          <div style={{ fontSize: 10, color: "var(--amber)" }}>
                            {money(invoice.amountDue, invoice.currency)} due
                          </div>
                        )}
                      </div>
                      <div className="sub-invoice-actions">
                        {invoice.invoicePdf && (
                          <a
                            className="btn btn-outline btn-sm"
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                          >
                            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                              <path d="M7 1v8M4 6l3 3 3-3M1 10v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                            PDF
                          </a>
                        )}
                        {invoice.hostedInvoiceUrl && (
                          <a
                            className="btn btn-outline btn-sm"
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                          >
                            View
                          </a>
                        )}
                        <button
                          className="sub-invoice-expand-btn"
                          aria-label="Toggle invoice details"
                          style={{ transform: expandedInvoice === invoice.id ? "rotate(180deg)" : "none" }}
                        >
                          ▾
                        </button>
                      </div>
                    </div>

                    {expandedInvoice === invoice.id && (
                      <div className="sub-invoice-detail">
                        <div className="sub-invoice-detail-grid">
                          <div>
                            <div className="sub-billing-stat-label">Invoice ID</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{invoice.id.slice(0, 24)}…</div>
                          </div>
                          <div>
                            <div className="sub-billing-stat-label">Period start</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                              {invoice.periodStart ? new Date(invoice.periodStart).toLocaleDateString("en-GB") : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="sub-billing-stat-label">Period end</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                              {invoice.periodEnd ? new Date(invoice.periodEnd).toLocaleDateString("en-GB") : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="sub-billing-stat-label">Amount paid</div>
                            <div style={{ fontSize: 12, color: "var(--mint)", fontWeight: 700, marginTop: 3 }}>
                              {money(invoice.amountPaid, invoice.currency)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="sub-empty-state">
                <div className="sub-empty-icon">◇</div>
                <div className="sub-empty-text">Invoices will appear after your first billing cycle is confirmed.</div>
              </div>
            )}
          </div>

          {/* Billing actions */}
          <div className="sub-card sub-billing-actions-card">
            <div className="sub-billing-action-item">
              <div>
                <div className="sub-billing-action-title">Request billing change</div>
                <div className="sub-billing-action-desc">Update payment method, request cancellation or modify your billing arrangement.</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={requestBillingSupport} disabled={busy}>
                Contact billing →
              </button>
            </div>
            <div className="sub-billing-action-item">
              <div>
                <div className="sub-billing-action-title">Invoice dispute or VAT query</div>
                <div className="sub-billing-action-desc">For invoice disputes, custom billing or tax questions, raise a support ticket.</div>
              </div>
              <Link href="/portal/support" className="btn btn-outline btn-sm">
                Open support →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TAB: CATALOGUE
      ═══════════════════════════════════════════════════ */}
      {activeTab === "catalogue" && (
        <div className="sub-tab-panel">
          <SubscriptionCatalogue plans={plans} addOns={addOns} properties={checkoutProperties} />
        </div>
      )}
    </div>
  );
}

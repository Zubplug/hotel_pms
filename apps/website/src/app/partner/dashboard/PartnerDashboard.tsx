"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PartnerShell } from "@/components/partner-shell";

type Property = {
  id: string; name: string; city: string; state: string; country: string;
  baseCurrency: string; website: string | null; bookingSlug: string | null;
  rooms: Array<{ id: string; name: string; description: string | null; baseRate: number; currency: string; maxOccupancy: number; bedConfiguration: string; amenities: string[]; photos: string[]; roomCount: number }>;
};
type Campaign  = { id: string; name: string; code: string; category: string; targetUrl: string | null; property: { name: string } };
type RecentClick   = { id: string; propertyName: string; campaignName: string; occurredAt: string };
type RecentBooking = { id: string; propertyName: string; campaignName: string; status: string; commissionAmount: number; commissionStatus: string; currency: string; createdAt: string };
type Stats = {
  properties: number; bookings: number; fulfilled: number; clicks: number; conversionRate: number | null;
  totalCommission: number; pending: number; approved: number; processing: number; paid: number;
  reversed: number; availableBalance: number; currency: string; paidCount: number;
};
type Data = {
  partner: { displayName: string; firstName: string | null; businessName: string | null; email: string; verificationStatus: string };
  properties: Property[];
  campaigns: Campaign[];
  recentClicks: RecentClick[];
  recentBookings: RecentBooking[];
  stats: Stats;
};

/* ── Helpers ── */
const money = (v: number, c = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);

const relDate = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/* ── Status pill ── */
function Pill({ value }: { value: string }) {
  const tone =
    ["FULFILLED", "PAID", "APPROVED", "PAYABLE", "VERIFIED"].includes(value)  ? "success" :
    ["CANCELLED", "REFUNDED", "REVERSED", "REJECTED"].includes(value)         ? "danger"  :
    "pending";
  return <span className={`reach-pill ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

/* ── Mini spark bars (pure CSS/HTML) ── */
function SparkBar({ pct, color = "#6366f1" }: { pct: number; color?: string }) {
  return (
    <div className="reach-progress">
      <i style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({
  icon, iconClass, label, value, sub, subLink,
}: {
  icon: string; iconClass: string; label: string; value: string; sub: string; subLink?: string;
}) {
  return (
    <article className="reach-kpi">
      <span className={`reach-kpi-icon ${iconClass}`}>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>
          {subLink ? <Link href={subLink}>{sub}</Link> : sub}
        </small>
      </div>
    </article>
  );
}

/* ── Quick action tile ── */
function ActionTile({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <Link href={href}>
      <b>{icon}</b>
      <span>{label}<small>{desc}</small></span>
    </Link>
  );
}

/* ── Property card ── */
function PropertyCard({ property }: { property: Property }) {
  const loc = [property.city, property.state, property.country].filter(Boolean).join(", ");
  return (
    <article className="reach-property-card">
      <div className="reach-property-image">
        <span>LC</span>
        <small>{property.baseCurrency}</small>
      </div>
      <div className="reach-property-body">
        <div className="reach-property-title">
          <div>
            <h3>{property.name}</h3>
            <p>{loc}</p>
          </div>
          <span className="reach-pill success">ACTIVE</span>
        </div>
        <div className="reach-property-meta">
          <span>{property.rooms.length} room categories</span>
          <span>{property.rooms.reduce((s, r) => s + r.roomCount, 0)} rooms</span>
        </div>
        <div className="reach-property-actions">
          <Link href={`/partner/properties/${property.id}`} className="reach-button secondary small">View</Link>
          <Link href={`/partner/links?propertyId=${property.id}`} className="reach-button primary small">Get link</Link>
        </div>
      </div>
    </article>
  );
}

/* ── Main dashboard ── */
export function PartnerDashboard({ data }: { data: Data }) {
  const [propertyId,   setPropertyId]   = useState(data.properties[0]?.id ?? "");
  const [campaignName, setCampaignName] = useState("");
  const [message,      setMessage]      = useState<string | null>(null);
  const [busy,         setBusy]         = useState(false);

  const firstName = data.partner.firstName ?? data.partner.displayName.split(" ")[0];
  const { stats } = data;
  const verified  = data.partner.verificationStatus === "VERIFIED";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    const res = await fetch("/api/partner/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId, name: campaignName, category: "STAY" }),
    });
    const payload = await res.json().catch(() => ({}));
    setMessage(
      res.ok
        ? "Campaign created — copy your referral link from My referral links."
        : payload.error ?? "Unable to create campaign. Please try again."
    );
    if (res.ok) setCampaignName("");
    setBusy(false);
  }

  function copy(value: string) {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
    setMessage("Referral link copied to clipboard.");
  }

  return (
    <PartnerShell
      partner={data.partner}
      availableBalance={stats.availableBalance}
      currency={stats.currency}
    >
      {/* ── Page header ── */}
      <div className="reach-page-head">
        <div>
          <span className="reach-eyebrow">Partner workspace</span>
          <h1>{greeting}, {firstName}</h1>
          <p>Discover properties, share trusted hospitality experiences, and grow your referral earnings.</p>
        </div>
        <div className="reach-head-actions">
          <Link href="/partner/properties" className="reach-button secondary">
            Explore properties ↗
          </Link>
          <Link href="/partner/links" className="reach-button primary">
            Create referral link +
          </Link>
        </div>
      </div>

      {/* ── Verification alert ── */}
      {!verified && (
        <div className="reach-alert" role="status">
          <span className="reach-alert-icon">!</span>
          <div>
            <strong>Profile under review</strong>
            <p>
              You can explore the catalogue and prepare campaigns. Referral attribution becomes
              active after LodgeCore verifies your partner profile.
            </p>
          </div>
          <Pill value={data.partner.verificationStatus} />
        </div>
      )}

      {/* ── KPIs ── */}
      <section className="reach-kpi-grid" aria-label="Key performance indicators">
        <KpiCard
          icon="₦" iconClass="green"
          label="Confirmed earnings"
          value={money(stats.paid, stats.currency)}
          sub={`${stats.paidCount} fulfilled referrals paid`}
        />
        <KpiCard
          icon="◷" iconClass="amber"
          label="Pending commission"
          value={money(stats.pending, stats.currency)}
          sub="Awaiting fulfilment or approval"
        />
        <KpiCard
          icon="◉" iconClass="blue"
          label="Available balance"
          value={money(stats.availableBalance, stats.currency)}
          sub="View payout wallet →"
          subLink="/partner/wallet"
        />
        <KpiCard
          icon="↗" iconClass="violet"
          label="Referral conversion"
          value={stats.conversionRate === null ? "—" : `${stats.conversionRate}%`}
          sub={`${stats.clicks} unique clicks · ${stats.bookings} bookings`}
        />
      </section>

      {/* ── Performance + Quick actions ── */}
      <div className="reach-dashboard-grid">
        {/* Performance bars */}
        <section className="reach-card">
          <div className="reach-card-head">
            <div>
              <span className="reach-eyebrow">At a glance</span>
              <h2>Referral performance</h2>
            </div>
            <Link href="/partner/analytics" className="reach-text-link">Open analytics →</Link>
          </div>

          <div className="reach-performance-bars">
            {[
              { label: "Approved & payable", amount: stats.approved,   color: undefined },
              { label: "Processing",          amount: stats.processing, color: "#f59e0b" },
              { label: "Reversed",            amount: stats.reversed,   color: "#f43f5e" },
            ].map(({ label, amount, color }) => {
              const pct = stats.totalCommission ? (amount / stats.totalCommission) * 100 : 0;
              return (
                <div key={label}>
                  <span>
                    <b>{label}</b>
                    <em>{money(amount, stats.currency)}</em>
                  </span>
                  <div className="reach-progress">
                    <i style={{ width: `${Math.min(100, pct)}%`, ...(color ? { background: color } : {}) }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="reach-summary-row">
            <div>
              <small>Total tracked commission</small>
              <strong>{money(stats.totalCommission, stats.currency)}</strong>
            </div>
            <div>
              <small>Fulfilled stays</small>
              <strong>{stats.fulfilled}</strong>
            </div>
            <div>
              <small>Active properties</small>
              <strong>{stats.properties}</strong>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="reach-card">
          <div className="reach-card-head">
            <div>
              <span className="reach-eyebrow">Workspace</span>
              <h2>Quick actions</h2>
            </div>
          </div>
          <div className="reach-action-grid">
            <ActionTile href="/partner/properties" icon="⌖" label="Explore hotels"      desc="Find promotable stays" />
            <ActionTile href="/partner/rooms"       icon="▣" label="Browse rooms"        desc="See real room categories" />
            <ActionTile href="/partner/events"      icon="◇" label="Find venues"         desc="Discover event spaces" />
            <ActionTile href="/partner/marketing"   icon="▧" label="Marketing studio"    desc="Approved materials" />
            <ActionTile href="/partner/campaigns"   icon="✦" label="Campaigns"           desc="Track your campaigns" />
            <ActionTile href="/partner/earnings"    icon="₦" label="Commission ledger"   desc="View earnings detail" />
          </div>
        </section>
      </div>

      {/* ── Recommended properties ── */}
      {data.properties.length > 0 && (
        <section className="reach-card" style={{ marginBottom: 18 }}>
          <div className="reach-card-head">
            <div>
              <span className="reach-eyebrow">Promotable catalogue</span>
              <h2>Recommended properties</h2>
              <p>Properties with an active Reach programme and published booking destination.</p>
            </div>
            <Link href="/partner/properties" className="reach-text-link">View all →</Link>
          </div>
          <div className="reach-property-grid">
            {data.properties.slice(0, 3).map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        </section>
      )}

      {data.properties.length === 0 && (
        <div className="reach-empty" style={{ marginBottom: 18 }}>
          <strong>No eligible properties yet</strong>
          <p>Participating properties appear here once their Reach programme and booking destination are active.</p>
        </div>
      )}

      {/* ── Recent activity + Create campaign ── */}
      <div className="reach-dashboard-grid bottom">
        {/* Activity feed */}
        <section className="reach-card">
          <div className="reach-card-head">
            <div>
              <span className="reach-eyebrow">Latest</span>
              <h2>Recent activity</h2>
            </div>
            <Link href="/partner/bookings" className="reach-text-link">See all →</Link>
          </div>
          <div className="reach-activity-list">
            {[
              ...data.recentBookings.map((b) => ({
                id: b.id,
                title: `${b.status === "FULFILLED" ? "Stay fulfilled" : "Referral booking"} · ${b.propertyName}`,
                detail: `${b.campaignName} · ${relDate(b.createdAt)}`,
                status: b.commissionStatus,
              })),
              ...data.recentClicks.map((c) => ({
                id: c.id,
                title: `Referral click · ${c.propertyName}`,
                detail: `${c.campaignName} · ${relDate(c.occurredAt)}`,
                status: "TRACKED",
              })),
            ]
              .slice(0, 8)
              .map((item) => (
                <div className="reach-activity" key={item.id}>
                  <span className="reach-activity-dot" />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <Pill value={item.status} />
                </div>
              ))}

            {!data.recentBookings.length && !data.recentClicks.length && (
              <div className="reach-empty compact">
                <strong>No activity yet</strong>
                <p>Referral clicks and bookings will appear here once you start sharing links.</p>
              </div>
            )}
          </div>
        </section>

        {/* Create campaign */}
        <section className="reach-card">
          <div className="reach-card-head">
            <div>
              <span className="reach-eyebrow">Start sharing</span>
              <h2>Create a campaign</h2>
              <p>Generate a trackable referral link for an eligible property.</p>
            </div>
          </div>

          {data.properties.length === 0 ? (
            <div className="reach-empty compact">
              <strong>No eligible properties</strong>
              <p>Properties with active Reach programmes will appear here.</p>
            </div>
          ) : (
            <form className="reach-campaign-form" onSubmit={createCampaign}>
              <label>
                Property
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  required
                >
                  <option value="">Choose a property</option>
                  {data.properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label>
                Campaign name
                <input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Weekend escape campaign"
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>

              <button
                className="reach-button primary"
                type="submit"
                disabled={busy || !propertyId}
              >
                {busy ? "Creating…" : "Create campaign →"}
              </button>
            </form>
          )}

          {message && (
            <p className="reach-form-message" role="status">{message}</p>
          )}

          {data.campaigns[0]?.targetUrl && (
            <div className="reach-link-preview">
              <span>Latest link</span>
              <input readOnly value={data.campaigns[0].targetUrl} aria-label="Latest referral link" />
              <button onClick={() => copy(data.campaigns[0].targetUrl ?? "")}>Copy</button>
            </div>
          )}
        </section>
      </div>
    </PartnerShell>
  );
}

"use client";
import { useRef, useState, useTransition } from "react";
import { saveBookingEngineConfig, saveBookingSite, publishBookingSite, unpublishBookingSite } from "./actions";
import { EnterpriseBookingSettings, type EnterpriseBookingSettingsProps } from "./EnterpriseBookingSettings";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RatePlan { id: string; name: string; code: string }

interface Config {
  enabled: boolean;
  publicSlug: string;
  paymentMode: string;
  minStay: number;
  maxStay: number | null;
  bookingLeadTimeHours: number;
  maxAdvanceDays: number | null;
  allowedRatePlanIds: string[];
}

interface Site {
  siteName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  templateKey: string;
  status: string;
  content: { tagline?: string } | null;
}

interface Props {
  propertyId: string;
  propertyName: string;
  entitled: boolean;
  config: Config | null;
  site: Site | null;
  ratePlans: RatePlan[];
  enterpriseSettings: Omit<EnterpriseBookingSettingsProps, "section">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_MODES = [
  { value: "PAY_LATER", label: "Pay Later", desc: "No online payment — reservation confirmed immediately." },
  { value: "DEPOSIT",   label: "Deposit",   desc: "Guest pays deposit online; balance at property." },
  { value: "FULL",      label: "Full payment", desc: "Guest pays the full amount online." },
];

const TEMPLATES = [
  { value: "CLASSIC_HOTEL", label: "Classic Hotel" },
  { value: "MODERN_BOUTIQUE", label: "Modern Boutique" },
  { value: "RESORT",        label: "Resort" },
  { value: "BUSINESS_HOTEL", label: "Business Hotel" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PUBLISHED: { cls: "badge-active",   label: "Published" },
    DRAFT:     { cls: "badge-pending",  label: "Draft" },
    SUSPENDED: { cls: "badge-inactive", label: "Suspended" },
  };
  const b = map[status] ?? { cls: "badge-inactive", label: status };
  return <span className={`portal-badge ${b.cls}`}>{b.label}</span>;
}

function SaveBar({ isPending, saved, error }: { isPending: boolean; saved: boolean; error: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
      <button
        type="submit"
        disabled={isPending}
        style={{
          background: "var(--accent)", color: "#fff", border: "none",
          borderRadius: "var(--radius-md)", padding: "8px 20px",
          fontSize: 13, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.7 : 1, fontFamily: "var(--font-display)",
        }}
      >
        {isPending ? "Saving…" : "Save Changes"}
      </button>
      {saved && <span style={{ fontSize: 12, color: "#3ef5a0", fontFamily: "var(--font-mono)" }}>✓ Saved</span>}
      {error && <span style={{ fontSize: 12, color: "var(--danger, #b42318)" }}>{error}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Config Form
// ─────────────────────────────────────────────────────────────────────────────

function EngineConfigForm({ propertyId, config, ratePlans }: { propertyId: string; config: Config | null; ratePlans: RatePlan[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(config?.enabled ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSaved(false);
    const fd = new FormData(formRef.current!);
    fd.set("enabled", enabled ? "true" : "false");
    startTransition(async () => {
      try { await saveBookingEngineConfig(propertyId, fd); setSaved(true); setTimeout(() => setSaved(false), 3000); }
      catch (err: any) { setError(err.message ?? "Failed to save"); }
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>

      {/* Enable toggle */}
      <div className="portal-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
            Enable Booking Engine
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {enabled ? "Active — guests can book online" : "Inactive — booking site is hidden from guests"}
          </div>
        </div>
        <button
          type="button" onClick={() => setEnabled(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: enabled ? "#3ef5a0" : "var(--border)", position: "relative",
            transition: "background .2s", flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute", top: 2, left: enabled ? 22 : 2,
            width: 20, height: 20, borderRadius: "50%", background: "#fff",
            transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          }} />
        </button>
      </div>

      {/* Slug */}
      <div className="portal-card" style={{ marginBottom: 16 }}>
        <div className="portal-card-title">Public URL</div>
        <div style={{
          display: "flex", alignItems: "stretch",
          border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden",
        }}>
          <span style={{
            padding: "9px 12px", fontSize: 12, color: "var(--text-muted)",
            background: "var(--bg-overlay)", borderRight: "1px solid var(--border)",
            whiteSpace: "nowrap", fontFamily: "var(--font-mono)",
          }}>
            book.lodgecore.com/
          </span>
          <input
            type="text" name="publicSlug"
            defaultValue={config?.publicSlug ?? ""}
            placeholder="my-hotel"
            pattern="[a-z0-9-]{3,}" required
            style={{
              flex: 1, padding: "9px 12px", fontSize: 13, background: "transparent",
              color: "var(--text-primary)", border: "none", outline: "none",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
          Lowercase letters, numbers and hyphens only. Min 3 characters.
        </p>
      </div>

      {/* Payment mode */}
      <div className="portal-card" style={{ marginBottom: 16 }}>
        <div className="portal-card-title">Payment Mode</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {PAYMENT_MODES.map(m => (
            <label key={m.value} style={{
              display: "flex", gap: 12, padding: "10px 14px",
              border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
              cursor: "pointer", alignItems: "flex-start",
            }}>
              <input
                type="radio" name="paymentMode" value={m.value}
                defaultChecked={config?.paymentMode === m.value || (!config && m.value === "PAY_LATER")}
                style={{ marginTop: 1, accentColor: "var(--accent)", flexShrink: 0 }}
              />
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Stay rules */}
      <div className="portal-card" style={{ marginBottom: 16 }}>
        <div className="portal-card-title">Stay Rules</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
          {[
            { label: "Min nights", name: "minStay", val: config?.minStay ?? 1, placeholder: "1" },
            { label: "Max nights", name: "maxStay", val: config?.maxStay ?? "", placeholder: "No limit" },
          ].map(f => (
            <div key={f.name}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-mono)", letterSpacing: ".05em", textTransform: "uppercase" }}>{f.label}</div>
              <input type="number" name={f.name} defaultValue={f.val} placeholder={f.placeholder} min={1}
                style={{
                  width: "100%", padding: "8px 12px", fontSize: 13,
                  background: "var(--bg-input, var(--bg-overlay))", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Booking window */}
      <div className="portal-card" style={{ marginBottom: 16 }}>
        <div className="portal-card-title">Booking Window</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
          {[
            { label: "Lead time (hours)", name: "bookingLeadTimeHours", val: config?.bookingLeadTimeHours ?? 0, placeholder: "0" },
            { label: "Max advance (days)", name: "maxAdvanceDays", val: config?.maxAdvanceDays ?? "", placeholder: "No limit" },
          ].map(f => (
            <div key={f.name}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-mono)", letterSpacing: ".05em", textTransform: "uppercase" }}>{f.label}</div>
              <input type="number" name={f.name} defaultValue={f.val} placeholder={f.placeholder} min={0}
                style={{
                  width: "100%", padding: "8px 12px", fontSize: 13,
                  background: "var(--bg-input, var(--bg-overlay))", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rate Plans */}
      {ratePlans.length > 0 && (
        <div className="portal-card" style={{ marginBottom: 16 }}>
          <div className="portal-card-title">Allowed Rate Plans</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 12 }}>
            Select which rate plans guests can see. Leave all unchecked to show all public plans.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ratePlans.map(rp => (
              <label key={rp.id} style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox" name="allowedRatePlanIds" value={rp.id}
                  defaultChecked={config?.allowedRatePlanIds.includes(rp.id) ?? false}
                  style={{ accentColor: "var(--accent)", width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-display)", fontWeight: 600 }}>
                  {rp.name}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {rp.code}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <SaveBar isPending={isPending} saved={saved} error={error} />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Branding Form
// ─────────────────────────────────────────────────────────────────────────────

function BrandingForm({ propertyId, site }: { propertyId: string; site: Site | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pubPending, startPubTransition] = useTransition();
  const [pubError, setPubError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaved(false);
    startTransition(async () => {
      try { await saveBookingSite(propertyId, new FormData(formRef.current!)); setSaved(true); setTimeout(() => setSaved(false), 3000); }
      catch (err: any) { setError(err.message ?? "Failed to save"); }
    });
  };

  const handlePublish = () => {
    setPubError(null);
    startPubTransition(async () => {
      try { await publishBookingSite(propertyId); }
      catch (err: any) { setPubError(err.message ?? "Failed to publish"); }
    });
  };

  const handleUnpublish = () => {
    startPubTransition(async () => {
      try { await unpublishBookingSite(propertyId); }
      catch (err: any) { setPubError(err.message ?? "Failed to unpublish"); }
    });
  };

  const isPublished = site?.status === "PUBLISHED";

  return (
    <div className="be-workspace">
      {/* Publish control */}
      <div className="portal-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: isPublished ? "#3ef5a0" : "#4e6678", display: "inline-block" }} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
              Site Status
            </div>
            {site && <StatusBadge status={site.status} />}
            {!site && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Not set up yet</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!isPublished && (
            <button
              type="button" onClick={handlePublish} disabled={pubPending || !site}
              className="btn btn-primary btn-sm" style={{ border: "none" }}
            >
              {pubPending ? "Publishing…" : "Publish →"}
            </button>
          )}
          {isPublished && (
            <button
              type="button" onClick={handleUnpublish} disabled={pubPending}
              className="btn btn-outline btn-sm"
            >
              {pubPending ? "Unpublishing…" : "Unpublish"}
            </button>
          )}
        </div>
      </div>
      {pubError && <div className="portal-card" style={{ color: "var(--danger, #b42318)", fontSize: 13, marginBottom: 12 }}>{pubError}</div>}

      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="portal-card" style={{ marginBottom: 16 }}>
          <div className="portal-card-title">Site Identity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
            {[
              { label: "Site name", name: "siteName", val: site?.siteName ?? "", placeholder: "The Grand Horizon", required: true, type: "text" },
              { label: "Tagline", name: "tagline", val: (site?.content as any)?.tagline ?? "", placeholder: "Your perfect stay awaits", required: false, type: "text" },
              { label: "Logo URL", name: "logoUrl", val: site?.logoUrl ?? "", placeholder: "https://...", required: false, type: "url" },
            ].map(f => (
              <div key={f.name}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5, fontFamily: "var(--font-mono)", letterSpacing: ".05em", textTransform: "uppercase" }}>{f.label}</div>
                <input type={f.type} name={f.name} defaultValue={f.val} placeholder={f.placeholder} required={f.required}
                  style={{
                    width: "100%", padding: "8px 12px", fontSize: 13,
                    background: "var(--bg-input, var(--bg-overlay))", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none",
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="portal-card" style={{ marginBottom: 16 }}>
          <div className="portal-card-title">Brand Colours</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
            {[
              { label: "Primary colour", name: "primaryColor", val: site?.primaryColor ?? "#1a56db" },
              { label: "Secondary colour", name: "secondaryColor", val: site?.secondaryColor ?? "#0e9f6e" },
            ].map(f => (
              <div key={f.name}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5, fontFamily: "var(--font-mono)", letterSpacing: ".05em", textTransform: "uppercase" }}>{f.label}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" name={f.name} defaultValue={f.val}
                    style={{ width: 36, height: 36, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", padding: 2, background: "none" }}
                  />
                  <input type="text" readOnly value={f.val}
                    style={{ flex: 1, padding: "8px 12px", fontSize: 12, fontFamily: "var(--font-mono)", background: "var(--bg-overlay)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-muted)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="portal-card" style={{ marginBottom: 16 }}>
          <div className="portal-card-title">Template</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 12 }}>
            {TEMPLATES.map(t => (
              <label key={t.value} style={{
                display: "flex", gap: 10, alignItems: "center",
                padding: "10px 14px", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", cursor: "pointer",
              }}>
                <input type="radio" name="templateKey" value={t.value}
                  defaultChecked={site?.templateKey === t.value || (!site && t.value === "CLASSIC_HOTEL")}
                  style={{ accentColor: "var(--accent)", flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)" }}>
                  {t.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <SaveBar isPending={isPending} saved={saved} error={error} />
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root exported component
// ─────────────────────────────────────────────────────────────────────────────

export function BookingEnginePropertyWorkspace({ propertyId, propertyName, entitled, config, site, ratePlans, enterpriseSettings }: Props) {
  const [tab, setTab] = useState<"engine" | "branding" | "content" | "payments" | "distribution">("engine");
  const isLive = config?.enabled && site?.status === "PUBLISHED";
  const bookingUrl = config?.publicSlug ? `https://book.lodgecore.com/book/${config.publicSlug}` : null;
  const tabs = [
    { id: "engine" as const, index: "01", label: "Engine", detail: "Availability & rates" },
    { id: "branding" as const, index: "02", label: "Branding", detail: "Look & feel" },
    { id: "content" as const, index: "03", label: "Guest experience", detail: "Content & policies" },
    { id: "payments" as const, index: "04", label: "Payments", detail: "Checkout setup" },
    { id: "distribution" as const, index: "05", label: "Distribution", detail: "Domain & growth" },
  ];

  return (
    <div className="be-workspace">
      {/* Header */}
      <div className="be-detail-hero">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="be-eyebrow"><span>PROPERTY WORKSPACE</span><i /> {isLive ? "LIVE DISTRIBUTION" : "CONFIGURATION"}</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.4rem,2.5vw,1.8rem)", fontWeight: 800, letterSpacing: "-.05em", color: "var(--text-primary)", marginBottom: 6 }}>
              {propertyName}
            </h1>
            <div className="be-detail-links">
              <span className={`be-live-dot ${isLive ? "is-live" : ""}`} />
              <span style={{ fontSize: 12, color: isLive ? "#3ef5a0" : "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {isLive ? "Live" : "Not live"}
              </span>
              {bookingUrl && (
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                  className="be-property-url">
                  {bookingUrl} ↗
                </a>
              )}
                <a href={`/portal/settings/booking-engine/${propertyId}/preview`} className="be-preview-link">Preview site ↗</a>
            </div>
          </div>
        </div>
      </div>

      {/* Entitlement warning */}
      {!entitled && (
        <div className="portal-card" style={{ marginBottom: 20, borderColor: "var(--amber, #ffbe5a)", background: "rgba(255,190,90,.06)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 3 }}>
                Booking Engine not activated for this property
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Purchase the Booking Engine add-on before saving settings or publishing this property’s booking site.
              </p>
              <a
                href="/portal/subscription"
                style={{ display: "inline-block", marginTop: 10, color: "var(--accent)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
              >
                Purchase Booking Engine add-on →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="be-flow-intro">
        <div>
          <div className="be-flow-kicker">Booking site setup</div>
          <strong>Build a direct booking experience that is ready to publish.</strong>
        </div>
        <span>{isLive ? "All systems live" : "Complete the setup in sequence"}</span>
      </div>

      <nav className="be-tabs" aria-label="Booking engine setup">
        {tabs.map(t => (
          <button
            key={t.id} type="button" onClick={() => setTab(t.id)}
            className={tab === t.id ? "is-active" : ""}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <span className="be-tab-index">{t.index}</span>
            <span><strong>{t.label}</strong><small>{t.detail}</small></span>
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === "engine" && (
        <EngineConfigForm propertyId={propertyId} config={config} ratePlans={ratePlans} />
      )}
      {tab === "branding" && (
        <BrandingForm propertyId={propertyId} site={site} />
      )}
      {tab === "content" && <EnterpriseBookingSettings {...enterpriseSettings} section="content" />}
      {tab === "payments" && <EnterpriseBookingSettings {...enterpriseSettings} section="payments" />}
      {tab === "distribution" && <EnterpriseBookingSettings {...enterpriseSettings} section="distribution" />}
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  nights: number;
  roomTypeName: string;
  ratePlanName: string;
  nightlyRate: number;
  totalAmount: number;
  currency: string;
  roomTypeId: string;
  ratePlanId: string;
  paymentMode: string;
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const COUNTRIES = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States",
  "Canada", "Australia", "Germany", "France", "India", "UAE", "Other"
];

export function GuestDetailsForm({
  slug, checkIn, checkOut, adults, children, nights,
  roomTypeName, ratePlanName, nightlyRate, totalAmount, currency,
  roomTypeId, ratePlanId, paymentMode,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [eta, setEta] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) { setError("Please accept the terms to continue"); return; }

    setLoading(true);
    try {
      // Step 1: Create a hold
      const holdRes = await fetch(`/api/public/booking/${slug}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomTypeId,
          ratePlanId,
          checkIn,
          checkOut,
          adults,
          children,
          guest: { firstName, lastName, email, phone, country, specialRequests, eta },
        }),
      });

      const holdResponse = await holdRes.json();
      if (!holdRes.ok) {
        throw new Error(holdResponse.error?.message ?? holdResponse.error ?? "Failed to hold room");
      }

      const holdData = holdResponse.data ?? holdResponse;
      const { holdToken } = holdData;

      // Step 2: Navigate to payment/confirm page
      const params = new URLSearchParams({
        checkIn, checkOut,
        adults: String(adults), children: String(children),
        roomTypeId, ratePlanId,
        holdToken,
        firstName, lastName, email, phone, country,
        specialRequests, eta,
      });
      startTransition(() => {
        router.push(`/book/${slug}/confirm?${params}`);
      });
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }} className="bk-guest-grid">

        {/* ── LEFT: Guest form ──────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Personal details */}
          <div style={{ background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)", padding: "24px 28px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-.04em", color: "var(--bk-text)", marginBottom: 20 }}>
              Your Details
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="First name" value={firstName} onChange={setFirstName} required placeholder="Jane" />
              <Field label="Last name" value={lastName} onChange={setLastName} required placeholder="Smith" />
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Email address" value={email} onChange={setEmail} required type="email" placeholder="jane@example.com" />
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Phone number" value={phone} onChange={setPhone} required type="tel" placeholder="+234 800 000 0000" />
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Country</label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Arrival preferences */}
          <div style={{ background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)", padding: "24px 28px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-.04em", color: "var(--bk-text)", marginBottom: 20 }}>
              Arrival Preferences
            </h2>
            <div>
              <label style={labelStyle}>Estimated arrival time <span style={{ color: "var(--bk-muted)", fontWeight: 400 }}>(optional)</span></label>
              <select value={eta} onChange={e => setEta(e.target.value)} style={inputStyle}>
                <option value="">Not sure yet</option>
                {["Before 12:00", "12:00 – 14:00", "14:00 – 16:00", "16:00 – 18:00", "18:00 – 20:00", "After 20:00"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Special requests <span style={{ color: "var(--bk-muted)", fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={specialRequests}
                onChange={e => setSpecialRequests(e.target.value)}
                rows={3}
                placeholder="Dietary requirements, accessibility needs, room preferences…"
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
              />
              <p style={{ fontSize: 11, color: "var(--bk-muted)", marginTop: 4 }}>
                We cannot guarantee all requests but will do our best to accommodate.
              </p>
            </div>
          </div>

          {/* Terms */}
          <div style={{ background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)", padding: "20px 24px" }}>
            <label style={{ display: "flex", gap: 12, cursor: "pointer", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                style={{ accentColor: "var(--bk-primary)", width: 16, height: 16, marginTop: 1, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: "var(--bk-muted)", lineHeight: 1.6 }}>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--bk-primary)", textDecoration: "underline" }}>Terms & Conditions</a>
                {" "}and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--bk-primary)", textDecoration: "underline" }}>Privacy Policy</a>.
                I understand that my reservation will be held for 15 minutes pending confirmation.
              </span>
            </label>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--bk-radius)", fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "15px 28px",
              background: "var(--bk-primary)", color: "#fff", border: "none",
              borderRadius: "var(--bk-radius)", fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, transition: "background .2s",
            }}
          >
            {loading ? "Securing your room…" : "Continue to Confirmation →"}
          </button>
        </div>

        {/* ── RIGHT: Booking summary ────────────────────────── */}
        <div
          style={{
            background: "var(--bk-surface)",
            border: "1px solid var(--bk-border)",
            borderRadius: "var(--bk-radius-lg)",
            padding: "24px",
            position: "sticky",
            top: 80,
          }}
        >
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "-.04em", color: "var(--bk-text)", marginBottom: 16 }}>
            Your Selection
          </h3>

          {/* Room */}
          <div style={{ padding: "14px 0", borderBottom: "1px solid var(--bk-border)" }}>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--bk-muted)", marginBottom: 4 }}>Room</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--bk-text)" }}>{roomTypeName}</div>
            <div style={{ fontSize: 12, color: "var(--bk-muted)", marginTop: 2 }}>{ratePlanName}</div>
          </div>

          {/* Dates */}
          <div style={{ padding: "14px 0", borderBottom: "1px solid var(--bk-border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--bk-muted)", marginBottom: 4 }}>Check-in</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--bk-text)" }}>{fmtDate(checkIn)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--bk-muted)", marginBottom: 4 }}>Check-out</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--bk-text)" }}>{fmtDate(checkOut)}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--bk-muted)" }}>
              {nights} night{nights !== 1 ? "s" : ""} · {adults} adult{adults !== 1 ? "s" : ""}
              {children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : ""}
            </div>
          </div>

          {/* Pricing */}
          <div style={{ padding: "14px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--bk-muted)", marginBottom: 6 }}>
              <span>{fmtCurrency(nightlyRate, currency)} × {nights} nights</span>
              <span>{fmtCurrency(totalAmount, currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-.04em", color: "var(--bk-text)", paddingTop: 10, borderTop: "1px solid var(--bk-border)" }}>
              <span>Total</span>
              <span>{fmtCurrency(totalAmount, currency)}</span>
            </div>
            {paymentMode === "PAY_LATER" && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                ✓ No payment required today
              </div>
            )}
            {paymentMode === "DEPOSIT" && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#eff6ff", borderRadius: 8, fontSize: 12, color: "var(--bk-primary)", fontWeight: 600 }}>
                Deposit required — balance at property
              </div>
            )}
            {paymentMode === "FULL" && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#eff6ff", borderRadius: 8, fontSize: 12, color: "var(--bk-primary)", fontWeight: 600 }}>
                Full payment due today
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .bk-guest-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </form>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--bk-muted)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontSize: 14,
  border: "1px solid var(--bk-border)",
  borderRadius: "var(--bk-radius)",
  background: "var(--bk-bg)",
  color: "var(--bk-text)",
  outline: "none",
  fontFamily: "var(--font-body)",
};

function Field({
  label, value, onChange, required, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} value={value} required={required}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

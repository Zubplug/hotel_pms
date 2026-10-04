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
    <form onSubmit={handleSubmit} className="bk-guest-form">
      <div className="bk-guest-grid">

        {/* ── LEFT: Guest form ──────────────────────────────── */}
        <div className="bk-guest-form-content">
          {/* Personal details */}
          <div className="bk-card">
            <h2 className="bk-card-title">Your Details</h2>
            <div className="bk-form-grid">
              <Field label="First name" value={firstName} onChange={setFirstName} required placeholder="Jane" />
              <Field label="Last name" value={lastName} onChange={setLastName} required placeholder="Smith" />
            </div>
            <div className="bk-form-row">
              <Field label="Email address" value={email} onChange={setEmail} required type="email" placeholder="jane@example.com" />
            </div>
            <div className="bk-form-grid">
              <Field label="Phone number" value={phone} onChange={setPhone} required type="tel" placeholder="+234 800 000 0000" />
              <div>
                <label className="bk-label">Country</label>
                <div className="bk-select-wrapper">
                  <select value={country} onChange={e => setCountry(e.target.value)} className="bk-input" required>
                    <option value="" disabled>Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Arrival preferences */}
          <div className="bk-card">
            <h2 className="bk-card-title">Arrival Preferences</h2>
            <div className="bk-form-row">
              <label className="bk-label">Estimated arrival time <span className="bk-label-opt">(optional)</span></label>
              <div className="bk-select-wrapper">
                <select value={eta} onChange={e => setEta(e.target.value)} className="bk-input">
                  <option value="">Not sure yet</option>
                  {["Before 12:00", "12:00 – 14:00", "14:00 – 16:00", "16:00 – 18:00", "18:00 – 20:00", "After 20:00"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bk-form-row">
              <label className="bk-label">Special requests <span className="bk-label-opt">(optional)</span></label>
              <textarea
                value={specialRequests}
                onChange={e => setSpecialRequests(e.target.value)}
                rows={3}
                placeholder="Dietary requirements, accessibility needs, room preferences…"
                className="bk-input bk-textarea"
              />
              <p className="bk-help-text">We cannot guarantee all requests but will do our best to accommodate.</p>
            </div>
          </div>

          {/* Terms */}
          <div className="bk-card bk-terms-card">
            <label className="bk-terms-label">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                className="bk-checkbox"
              />
              <span className="bk-terms-text">
                I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms & Conditions</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>. I understand that my reservation will be held for 15 minutes pending confirmation.
              </span>
            </label>
          </div>

          {error && (
            <div className="bk-error-alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`bk-submit-btn ${loading ? 'loading' : ''}`}
          >
            {loading ? (
              <>
                <div className="bk-spinner"></div>
                Securing your room…
              </>
            ) : (
              "Continue to Confirmation →"
            )}
          </button>
        </div>

        {/* ── RIGHT: Booking summary ────────────────────────── */}
        <div className="bk-summary-card">
          <h3 className="bk-card-title">Your Selection</h3>

          {/* Room */}
          <div className="bk-summary-section">
            <div className="bk-summary-label">Room</div>
            <div className="bk-summary-value">{roomTypeName}</div>
            <div className="bk-summary-subvalue">{ratePlanName}</div>
          </div>

          {/* Dates */}
          <div className="bk-summary-section">
            <div className="bk-dates-grid">
              <div>
                <div className="bk-summary-label">Check-in</div>
                <div className="bk-summary-value">{fmtDate(checkIn)}</div>
              </div>
              <div>
                <div className="bk-summary-label">Check-out</div>
                <div className="bk-summary-value">{fmtDate(checkOut)}</div>
              </div>
            </div>
            <div className="bk-summary-subvalue" style={{ marginTop: 12 }}>
              {nights} night{nights !== 1 ? "s" : ""} · {adults} adult{adults !== 1 ? "s" : ""}
              {children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : ""}
            </div>
          </div>

          {/* Pricing */}
          <div className="bk-summary-section" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div className="bk-price-row">
              <span>{fmtCurrency(nightlyRate, currency)} × {nights} nights</span>
              <span>{fmtCurrency(totalAmount, currency)}</span>
            </div>
            <div className="bk-price-total-row">
              <span>Total</span>
              <span>{fmtCurrency(totalAmount, currency)}</span>
            </div>
            
            <div className="bk-payment-status">
              {paymentMode === "PAY_LATER" && (
                <div className="bk-status-chip success">✓ No payment required today</div>
              )}
              {paymentMode === "DEPOSIT" && (
                <div className="bk-status-chip highlight">Deposit required — balance at property</div>
              )}
              {paymentMode === "FULL" && (
                <div className="bk-status-chip highlight">Full payment due today</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bk-guest-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 32px;
          align-items: start;
        }
        .bk-guest-form-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .bk-card {
          background: var(--bk-surface);
          border: 1px solid var(--bk-border);
          border-radius: var(--bk-radius-lg);
          padding: 32px;
          box-shadow: var(--bk-shadow);
        }
        .bk-card-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -.03em;
          color: var(--bk-text);
          margin-bottom: 24px;
        }

        .bk-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .bk-form-row {
          margin-bottom: 16px;
        }

        .bk-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: var(--bk-muted);
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 8px;
          font-family: var(--font-mono);
        }
        .bk-label-opt {
          color: color-mix(in srgb, var(--bk-muted) 60%, transparent);
          font-weight: 400;
          text-transform: none;
          letter-spacing: normal;
          font-family: var(--font-body);
        }

        .bk-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 15px;
          border: 1px solid var(--bk-border);
          border-radius: var(--bk-radius);
          background: rgba(0,0,0,0.15);
          color: var(--bk-text);
          outline: none;
          font-family: var(--font-body);
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .bk-input:hover {
          background: rgba(0,0,0,0.25);
          border-color: color-mix(in srgb, var(--bk-border) 80%, white);
        }
        .bk-input:focus {
          border-color: var(--bk-primary);
          background: var(--bk-surface-raised);
          box-shadow: 0 0 0 3px var(--bk-primary-dim);
        }
        .bk-textarea {
          resize: vertical;
          min-height: 100px;
        }

        .bk-select-wrapper {
          position: relative;
        }
        .bk-select-wrapper::after {
          content: "▼";
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 10px;
          color: var(--bk-muted);
          pointer-events: none;
        }
        .bk-input[type="select"], select.bk-input {
          appearance: none;
          padding-right: 40px;
        }

        .bk-help-text {
          font-size: 12px;
          color: var(--bk-muted);
          margin-top: 6px;
          line-height: 1.5;
        }

        .bk-terms-card {
          padding: 24px 32px;
          background: color-mix(in srgb, var(--bk-primary) 5%, var(--bk-surface));
          border-color: color-mix(in srgb, var(--bk-primary) 15%, var(--bk-border));
        }
        .bk-terms-label {
          display: flex;
          gap: 16px;
          cursor: pointer;
          align-items: flex-start;
        }
        .bk-checkbox {
          appearance: none;
          width: 20px;
          height: 20px;
          border: 1px solid var(--bk-border);
          border-radius: 4px;
          background: rgba(0,0,0,0.2);
          margin-top: 2px;
          flex-shrink: 0;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: all 0.2s;
        }
        .bk-checkbox:checked {
          background: var(--bk-primary);
          border-color: var(--bk-primary);
        }
        .bk-checkbox:checked::after {
          content: "";
          width: 10px;
          height: 10px;
          background: var(--bk-bg);
          clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
        }
        .bk-terms-text {
          font-size: 13px;
          color: var(--bk-muted);
          line-height: 1.6;
        }
        .bk-terms-text a {
          color: var(--bk-text);
          font-weight: 500;
          text-decoration: none;
          border-bottom: 1px solid var(--bk-primary);
          transition: color 0.2s;
        }
        .bk-terms-text a:hover {
          color: var(--bk-primary);
        }

        .bk-submit-btn {
          padding: 0 40px;
          height: 56px;
          background: var(--bk-primary);
          color: #000;
          border: none;
          border-radius: var(--bk-radius);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 15px;
          letter-spacing: -.01em;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 8px 20px var(--bk-primary-dim);
        }
        .bk-submit-btn:hover:not(:disabled) {
          background: var(--bk-primary-hover);
          transform: translateY(-2px);
          box-shadow: 0 12px 24px var(--bk-primary-dim);
        }
        .bk-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .bk-submit-btn.loading {
          cursor: not-allowed;
          opacity: 0.9;
        }

        .bk-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .bk-error-alert {
          padding: 16px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: var(--bk-radius);
          font-size: 14px;
          color: #ef4444;
          font-weight: 500;
        }

        .bk-summary-card {
          background: var(--bk-surface);
          border: 1px solid var(--bk-border);
          border-radius: var(--bk-radius-lg);
          padding: 32px;
          position: sticky;
          top: 100px;
          box-shadow: var(--bk-shadow);
        }
        .bk-summary-section {
          padding: 16px 0;
          border-bottom: 1px solid var(--bk-border);
        }
        .bk-summary-label {
          font-size: 10px;
          font-family: var(--font-mono);
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--bk-muted);
          margin-bottom: 6px;
        }
        .bk-summary-value {
          font-weight: 700;
          font-size: 15px;
          color: var(--bk-text);
          font-family: var(--font-display);
        }
        .bk-summary-subvalue {
          font-size: 13px;
          color: var(--bk-muted);
          margin-top: 4px;
        }
        .bk-dates-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .bk-price-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: var(--bk-muted);
          margin-bottom: 12px;
        }
        .bk-price-total-row {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 20px;
          letter-spacing: -.03em;
          color: var(--bk-text);
          padding-top: 16px;
          border-top: 1px solid var(--bk-border);
        }
        .bk-payment-status {
          margin-top: 20px;
        }
        .bk-status-chip {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .02em;
        }
        .bk-status-chip.success {
          background: rgba(74, 222, 128, 0.1);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.2);
        }
        .bk-status-chip.highlight {
          background: var(--bk-primary-dim);
          color: var(--bk-primary);
          border: 1px solid color-mix(in srgb, var(--bk-primary) 30%, transparent);
        }

        @media (max-width: 900px) {
          .bk-guest-grid { grid-template-columns: 1fr; gap: 24px; }
          .bk-summary-card { position: static; }
        }
        @media (max-width: 600px) {
          .bk-form-grid { grid-template-columns: 1fr; gap: 16px; margin-bottom: 16px; }
          .bk-card { padding: 24px; }
        }
      `}</style>
    </form>
  );
}

function Field({
  label, value, onChange, required, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="bk-label">{label}</label>
      <input
        type={type} value={value} required={required}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="bk-input"
      />
    </div>
  );
}

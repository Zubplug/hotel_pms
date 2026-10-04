"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

interface Props {
  slug: string;
  holdToken: string;
  firstName: string;
  lastName: string;
  email: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  roomTypeName: string;
  ratePlanName: string;
  totalAmount: number;
  nightlyRate: number;
  currency: string;
  paymentMode: string;
  specialRequests: string;
  eta: string;
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const HOLD_DURATION_SECS = 12 * 60; // 12-minute hold

function ProcessingOverlay() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
      animation: "fadeIn 0.3s ease-out"
    }}>
      <div className="bk-processing-spinner"></div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, color: "#fff", marginTop: 32, letterSpacing: "-.02em" }}>
        Confirming your reservation...
      </h2>
      <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 12, fontSize: 15 }}>
        Please do not close or refresh this page.
      </p>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .bk-processing-spinner {
          width: 64px; height: 64px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top-color: var(--bk-primary);
          border-radius: 50%;
          animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body
  );
}

export function ConfirmBookingPanel({
  slug, holdToken, firstName, lastName, email,
  checkIn, checkOut, nights, adults, children,
  roomTypeName, ratePlanName, totalAmount, nightlyRate, currency,
  paymentMode, specialRequests, eta,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(HOLD_DURATION_SECS);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const holdExpired = timeLeft <= 0;

  const handleConfirm = async () => {
    if (holdExpired) { setError("Your hold has expired. Please search again."); return; }
    setLoading(true); setError(null);

    try {
      const res = await fetch(`/api/public/booking/${slug}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ holdToken, guest: { firstName, lastName, email }, adults, children, specialRequests }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? data.error ?? "Booking failed");

      const { confirmationToken } = data.data ?? data;

      if (paymentMode === "PAY_LATER") {
        // No payment needed — go straight to confirmation page
        startTransition(() => {
          router.push(`/book/${slug}/confirmation?token=${confirmationToken}`);
        });
      } else {
        // DEPOSIT or FULL — go to Paystack
        const payRes = await fetch(`/api/public/booking/${slug}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationToken: confirmationToken,
            guestEmail: email,
            callbackUrl: `${window.location.origin}/book/${slug}/confirmation?token=${confirmationToken}`,
          }),
        });
        const payData = await payRes.json();
        if (!payRes.ok) throw new Error(payData.error?.message ?? payData.error ?? "Payment initiation failed");

        // Redirect to Paystack payment page
        const payment = payData.data ?? payData;
        if (payment.authorizationUrl) {
          window.location.href = payment.authorizationUrl;
        } else {
          throw new Error("No payment URL returned");
        }
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <ProcessingOverlay />}
      <div className="bk-confirm-grid">

        {/* ── LEFT: Summary ─────────────────────────────────── */}
        <div className="bk-confirm-content">
          {/* Hold timer */}
          <div className={`bk-hold-timer ${holdExpired ? 'expired' : timeLeft < 120 ? 'warning' : 'active'}`}>
            <div className="bk-hold-icon">⏱</div>
            <div>
              {holdExpired ? (
                <>
                  <div className="bk-hold-title">Hold expired</div>
                  <p className="bk-hold-desc">Please search again to find available rooms.</p>
                </>
              ) : (
                <>
                  <div className="bk-hold-title">
                    Room held for you — <span className="bk-countdown">{mins}:{secs}</span> remaining
                  </div>
                  <p className="bk-hold-desc">
                    Complete your booking before the hold expires.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Booking review */}
          <div className="bk-card">
            <h2 className="bk-card-title">
              Review Your Booking
            </h2>

            <div className="bk-review-list">
              {[
                { label: "Guest", value: `${firstName} ${lastName}` },
                { label: "Email", value: email },
                { label: "Room", value: roomTypeName },
                { label: "Rate plan", value: ratePlanName },
                { label: "Check-in", value: fmtDate(checkIn) },
                { label: "Check-out", value: fmtDate(checkOut) },
                { label: "Nights", value: String(nights) },
                { label: "Guests", value: `${adults} adult${adults !== 1 ? "s" : ""}${children > 0 ? `, ${children} child${children !== 1 ? "ren" : ""}` : ""}` },
                ...(specialRequests ? [{ label: "Requests", value: specialRequests }] : []),
                ...(eta ? [{ label: "Arrival", value: eta }] : []),
              ].map(row => (
                <div key={row.label} className="bk-review-row">
                  <span className="bk-review-label">{row.label}</span>
                  <span className="bk-review-value">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="bk-error-alert">
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || holdExpired}
            className={`bk-confirm-btn ${loading || holdExpired ? 'disabled' : ''}`}
          >
            {holdExpired
              ? "Hold expired"
              : paymentMode === "PAY_LATER"
              ? "Confirm Booking (No payment now) →"
              : `Pay ${fmtCurrency(totalAmount, currency)} & Confirm →`
            }
          </button>

          <p className="bk-policy-note">
            By confirming, you agree to our cancellation and booking policies.
          </p>
        </div>

        {/* ── RIGHT: Price breakdown ─────────────────────────── */}
        <div className="bk-summary-card">
          <h3 className="bk-card-title">
            Price Summary
          </h3>

          <div className="bk-summary-section">
            <div className="bk-price-row">
              <span>{fmtCurrency(nightlyRate, currency)} × {nights} night{nights !== 1 ? "s" : ""}</span>
              <span>{fmtCurrency(totalAmount, currency)}</span>
            </div>
          </div>

          <div className="bk-summary-section" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div className="bk-price-total-row">
              <span>Total</span>
              <span>{fmtCurrency(totalAmount, currency)}</span>
            </div>

            {/* Payment mode badge */}
            <div className={`bk-payment-mode-badge ${paymentMode === "PAY_LATER" ? 'success' : 'highlight'}`}>
              {paymentMode === "PAY_LATER" && "✓ No payment required today"}
              {paymentMode === "DEPOSIT" && "Deposit required · balance at property"}
              {paymentMode === "FULL" && "Full payment due now"}
            </div>

            <div className="bk-confirmation-note">
              Confirmation will be sent to <strong>{email}</strong>
            </div>
          </div>
        </div>

        <style>{`
          .bk-confirm-grid {
            display: grid;
            grid-template-columns: 1fr 380px;
            gap: 32px;
            align-items: start;
          }
          .bk-confirm-content {
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

          .bk-hold-timer {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 20px 24px;
            border-radius: var(--bk-radius-lg);
            border: 1px solid transparent;
            transition: all 0.3s ease;
          }
          .bk-hold-timer.active {
            background: color-mix(in srgb, var(--bk-primary) 10%, var(--bk-surface));
            border-color: color-mix(in srgb, var(--bk-primary) 30%, transparent);
          }
          .bk-hold-timer.warning {
            background: rgba(251,191,36,0.1);
            border-color: rgba(251,191,36,0.3);
          }
          .bk-hold-timer.expired {
            background: rgba(239,68,68,0.1);
            border-color: rgba(239,68,68,0.3);
          }
          .bk-hold-icon {
            font-size: 28px;
            flex-shrink: 0;
            animation: pulse 2s infinite;
          }
          @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
          
          .bk-hold-title {
            font-weight: 700;
            font-size: 14px;
            font-family: var(--font-display);
            margin-bottom: 4px;
          }
          .bk-hold-timer.active .bk-hold-title { color: var(--bk-primary); }
          .bk-hold-timer.warning .bk-hold-title { color: #fbbf24; }
          .bk-hold-timer.expired .bk-hold-title { color: #ef4444; }
          .bk-countdown {
            font-family: var(--font-mono);
            font-size: 16px;
            letter-spacing: .05em;
          }
          .bk-hold-desc {
            font-size: 13px;
          }
          .bk-hold-timer.active .bk-hold-desc { color: color-mix(in srgb, var(--bk-primary) 70%, transparent); }
          .bk-hold-timer.warning .bk-hold-desc { color: rgba(251,191,36,0.8); }
          .bk-hold-timer.expired .bk-hold-desc { color: rgba(239,68,68,0.8); }

          .bk-review-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .bk-review-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding-bottom: 16px;
            border-bottom: 1px dashed var(--bk-border);
            gap: 16px;
          }
          .bk-review-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
          .bk-review-label {
            font-size: 13px;
            color: var(--bk-muted);
            flex-shrink: 0;
          }
          .bk-review-value {
            font-size: 15px;
            font-weight: 600;
            color: var(--bk-text);
            text-align: right;
            word-break: break-word;
          }

          .bk-confirm-btn {
            padding: 0 40px;
            height: 64px;
            background: var(--bk-primary);
            color: #000;
            border: none;
            border-radius: var(--bk-radius);
            font-family: var(--font-display);
            font-weight: 800;
            font-size: 16px;
            letter-spacing: -.01em;
            cursor: pointer;
            transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
            box-shadow: 0 8px 24px var(--bk-primary-dim);
            width: 100%;
          }
          .bk-confirm-btn:hover:not(.disabled) {
            background: var(--bk-primary-hover);
            transform: translateY(-2px);
            box-shadow: 0 12px 32px var(--bk-primary-dim);
          }
          .bk-confirm-btn:active:not(.disabled) {
            transform: translateY(0);
          }
          .bk-confirm-btn.disabled {
            background: var(--bk-surface-raised);
            color: var(--bk-muted);
            cursor: not-allowed;
            box-shadow: none;
          }

          .bk-policy-note {
            font-size: 12px;
            color: var(--bk-muted);
            text-align: center;
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
            padding: 20px 0;
            border-bottom: 1px solid var(--bk-border);
          }
          .bk-summary-section:first-of-type {
            padding-top: 0;
          }
          
          .bk-price-row {
            display: flex;
            justify-content: space-between;
            font-size: 15px;
            color: var(--bk-muted);
          }
          .bk-price-total-row {
            display: flex;
            justify-content: space-between;
            font-family: var(--font-display);
            font-weight: 800;
            font-size: 24px;
            letter-spacing: -.03em;
            color: var(--bk-text);
          }

          .bk-payment-mode-badge {
            margin-top: 24px;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            text-align: center;
          }
          .bk-payment-mode-badge.success {
            background: rgba(74, 222, 128, 0.1);
            color: #4ade80;
            border: 1px solid rgba(74, 222, 128, 0.2);
          }
          .bk-payment-mode-badge.highlight {
            background: var(--bk-primary-dim);
            color: var(--bk-primary);
            border: 1px solid color-mix(in srgb, var(--bk-primary) 30%, transparent);
          }

          .bk-confirmation-note {
            margin-top: 20px;
            font-size: 12px;
            color: var(--bk-muted);
            text-align: center;
            line-height: 1.6;
          }
          .bk-confirmation-note strong {
            color: var(--bk-text);
          }

          @media (max-width: 900px) {
            .bk-confirm-grid { grid-template-columns: 1fr; gap: 24px; }
            .bk-summary-card { position: static; }
          }
        `}</style>
      </div>
    </>
  );
}

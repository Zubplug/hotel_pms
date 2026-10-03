"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }} className="bk-confirm-grid">

      {/* ── LEFT: Summary ─────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Hold timer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 20px",
            background: holdExpired ? "#fef2f2" : timeLeft < 120 ? "#fffbeb" : "#f0fdf4",
            border: `1px solid ${holdExpired ? "#fecaca" : timeLeft < 120 ? "#fde68a" : "#bbf7d0"}`,
            borderRadius: "var(--bk-radius)",
          }}
        >
          <div style={{ fontSize: 24, flexShrink: 0 }}>⏱</div>
          <div>
            {holdExpired ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", fontFamily: "var(--font-display)" }}>Hold expired</div>
                <p style={{ fontSize: 12, color: "#dc2626" }}>Please search again to find available rooms.</p>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 13, color: timeLeft < 120 ? "#92400e" : "#15803d", fontFamily: "var(--font-display)" }}>
                  Room held for you — {mins}:{secs} remaining
                </div>
                <p style={{ fontSize: 12, color: timeLeft < 120 ? "#92400e" : "#15803d" }}>
                  Complete your booking before the hold expires.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Booking review */}
        <div style={{ background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)", padding: "24px 28px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "-.04em", color: "var(--bk-text)", marginBottom: 20 }}>
            Review Your Booking
          </h2>

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
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bk-border)", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--bk-muted)", flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--bk-text)", textAlign: "right" }}>{row.value}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--bk-radius)", fontSize: 13, color: "#dc2626" }}>
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || holdExpired}
          style={{
            padding: "16px 28px",
            background: holdExpired ? "var(--bk-border)" : "var(--bk-primary)",
            color: holdExpired ? "var(--bk-muted)" : "#fff",
            border: "none", borderRadius: "var(--bk-radius)",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16,
            cursor: loading || holdExpired ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, transition: "background .2s",
          }}
        >
          {loading
            ? (paymentMode === "PAY_LATER" ? "Confirming…" : "Processing payment…")
            : holdExpired
            ? "Hold expired"
            : paymentMode === "PAY_LATER"
            ? "Confirm Booking (No payment now) →"
            : `Pay ${fmtCurrency(totalAmount, currency)} & Confirm →`
          }
        </button>

        <p style={{ fontSize: 11, color: "var(--bk-muted)", textAlign: "center" }}>
          By confirming, you agree to our cancellation and booking policies.
        </p>
      </div>

      {/* ── RIGHT: Price breakdown ─────────────────────────── */}
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
          Price Summary
        </h3>

        <div style={{ padding: "12px 0", borderBottom: "1px solid var(--bk-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--bk-muted)" }}>
            <span>{fmtCurrency(nightlyRate, currency)} × {nights} night{nights !== 1 ? "s" : ""}</span>
            <span>{fmtCurrency(totalAmount, currency)}</span>
          </div>
        </div>

        <div style={{ paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, letterSpacing: "-.05em", color: "var(--bk-text)" }}>
            <span>Total</span>
            <span>{fmtCurrency(totalAmount, currency)}</span>
          </div>
        </div>

        {/* Payment mode badge */}
        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: paymentMode === "PAY_LATER" ? "#f0fdf4" : "#eff6ff", fontSize: 12, fontWeight: 600, color: paymentMode === "PAY_LATER" ? "#16a34a" : "var(--bk-primary)" }}>
          {paymentMode === "PAY_LATER" && "✓ No payment required today"}
          {paymentMode === "DEPOSIT" && "Deposit required · balance at property"}
          {paymentMode === "FULL" && "Full payment due now"}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "var(--bk-muted)", lineHeight: 1.6 }}>
          Confirmation will be sent to <strong style={{ color: "var(--bk-text)" }}>{email}</strong>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .bk-confirm-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

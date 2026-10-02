"use client";
import { useState, useTransition } from "react";

interface Props {
  slug: string;
  confirmationNumber: string;
  canCancel: boolean;
  cancelTokenAvailable: boolean;
}

export function ManageBookingActions({ slug, confirmationNumber, canCancel, cancelTokenAvailable }: Props) {
  const [, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "confirm" | "cancelling" | "cancelled" | "error">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cancelToken, setCancelToken] = useState("");

  const handleCancelRequest = () => setPhase("confirm");

  const handleCancelConfirm = async () => {
    if (!cancelToken.trim()) { setError("Enter the cancel code from your confirmation email"); return; }
    setPhase("cancelling"); setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/public/booking/${slug}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cancelToken: cancelToken.trim(), reason }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message ?? data.error ?? "Cancellation failed");
        setPhase("cancelled");
      } catch (err: any) {
        setError(err.message ?? "Cancellation failed");
        setPhase("confirm");
      }
    });
  };

  if (phase === "cancelled") {
    return (
      <div style={{ padding: "24px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "var(--bk-radius-lg)", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "#15803d", marginBottom: 6 }}>
          Booking Cancelled
        </div>
        <p style={{ fontSize: 13, color: "#15803d" }}>
          Your reservation {confirmationNumber} has been cancelled. A confirmation will be sent to your email.
        </p>
      </div>
    );
  }

  if (phase === "confirm") {
    return (
      <div style={{ background: "var(--bk-surface)", border: "1px solid #fecaca", borderRadius: "var(--bk-radius-lg)", padding: "24px" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#dc2626", marginBottom: 14 }}>
          Cancel this booking?
        </h3>
        <p style={{ fontSize: 13, color: "var(--bk-muted)", marginBottom: 16 }}>
          This action cannot be undone. Cancellation fees may apply per the property's cancellation policy.
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Cancel code (from your email) *
          </label>
          <input
            type="text"
            value={cancelToken}
            onChange={e => setCancelToken(e.target.value)}
            placeholder="Paste your cancellation code"
            style={{
              width: "100%", padding: "10px 14px", fontSize: 13,
              border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)",
              background: "var(--bk-bg)", color: "var(--bk-text)", outline: "none",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Reason for cancellation <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="Change of plans, medical reason…"
            style={{
              width: "100%", padding: "10px 14px", fontSize: 13,
              border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)",
              background: "var(--bk-bg)", color: "var(--bk-text)", outline: "none",
              resize: "vertical", fontFamily: "var(--font-body)",
            }}
          />
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleCancelConfirm}
            style={{
              padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none",
              borderRadius: "var(--bk-radius)", fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Yes, Cancel Booking
          </button>
          <button
            type="button"
            onClick={() => { setPhase("idle"); setError(null); }}
            style={{
              padding: "10px 20px", background: "transparent", color: "var(--bk-muted)",
              border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)",
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Keep booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {canCancel && (
        <button
          type="button"
          onClick={handleCancelRequest}
          style={{
            padding: "10px 20px", background: "transparent", color: "#dc2626",
            border: "1px solid #fecaca", borderRadius: "var(--bk-radius)",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}
        >
          Cancel this booking
        </button>
      )}
      {!canCancel && (
        <p style={{ fontSize: 13, color: "var(--bk-muted)" }}>
          This booking cannot be self-cancelled. Please contact the property directly.
        </p>
      )}
    </div>
  );
}

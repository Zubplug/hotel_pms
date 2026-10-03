"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";



interface Props {
  room: {
    roomTypeId: string;
    roomTypeName: string;
    description?: string | null;
    images?: string[];
    maxOccupancy: number;
    availableRooms: number;
    rates: {
      ratePlanId: string;
      ratePlanName: string;
      ratePlanCode: string;
      nightlyRate: number;
      totalAmount: number;
      currency: string;
      cancellationPolicyName?: string;
    }[];
  };
  slug: string;
  checkIn: string;
  checkOut: string;
  adults: string;
  children: string;
  nights: number;
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

export function RoomCard({ room, slug, checkIn, checkOut, adults, children, nights, paymentMode }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedRateIdx, setSelectedRateIdx] = useState(0);

  const images = room.images ?? [];
  const rates = room.rates ?? [];
  const selectedRate = rates[selectedRateIdx];

  if (!selectedRate) return null;

  const handleSelect = () => {
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      adults,
      children,
      roomTypeId: room.roomTypeId,
      ratePlanId: selectedRate.ratePlanId,
    });
    startTransition(() => {
      router.push(`/book/${slug}/guest?${params}`);
    });
  };

  return (
    <div
      style={{
        background: "var(--bk-surface)",
        border: "1px solid var(--bk-border)",
        borderRadius: "var(--bk-radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--bk-shadow)",
        display: "grid",
        gridTemplateColumns: "280px 1fr",
      }}
      className="bk-room-result"
    >
      {/* Image */}
      <div
        style={{
          background: images[0]
            ? `url(${images[0]}) center/cover no-repeat`
            : "linear-gradient(135deg, var(--bk-primary-dim), color-mix(in srgb, var(--bk-primary) 8%, transparent))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 220,
        }}
      >
        {!images[0] && <span style={{ fontSize: 36, opacity: 0.25 }}>🏨</span>}
      </div>

      {/* Details */}
      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Name + occupancy */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "-.04em", color: "var(--bk-text)", marginBottom: 4 }}>
              {room.roomTypeName}
            </h3>
            {room.description && (
              <p style={{ fontSize: 13, color: "var(--bk-muted)", lineHeight: 1.6, maxWidth: 420, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {room.description}
              </p>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <span style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 6, padding: "3px 8px", color: "var(--bk-muted)", fontWeight: 600 }}>
              👤 Max {room.maxOccupancy}
            </span>
            {room.availableRooms <= 3 && (
              <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>
                Only {room.availableRooms} left!
              </div>
            )}
          </div>
        </div>

        {/* Rate plan selector (tabs if multiple) */}
        {rates.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {rates.map((rate, i) => (
              <button
                key={rate.ratePlanId}
                type="button"
                onClick={() => setSelectedRateIdx(i)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: `1px solid ${i === selectedRateIdx ? "var(--bk-primary)" : "var(--bk-border)"}`,
                  background: i === selectedRateIdx ? "var(--bk-primary-dim)" : "transparent",
                  color: i === selectedRateIdx ? "var(--bk-primary)" : "var(--bk-muted)",
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "var(--font-mono)",
                  letterSpacing: ".04em",
                }}
              >
                {rate.ratePlanName}
              </button>
            ))}
          </div>
        )}

        {/* Pricing + CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--bk-border)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, letterSpacing: "-.04em", color: "var(--bk-text)" }}>
                {fmtCurrency(selectedRate.nightlyRate, selectedRate.currency)}
              </span>
              <span style={{ fontSize: 12, color: "var(--bk-muted)" }}>/ night</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--bk-muted)", marginTop: 2 }}>
              Total: <strong style={{ color: "var(--bk-text)" }}>{fmtCurrency(selectedRate.totalAmount, selectedRate.currency)}</strong>
              {" for "}{nights} night{nights !== 1 ? "s" : ""}
            </div>
            {paymentMode === "PAY_LATER" && (
              <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginTop: 4 }}>
                ✓ No payment required now
              </div>
            )}
            {paymentMode === "DEPOSIT" && (
              <div style={{ fontSize: 11, color: "var(--bk-primary)", fontWeight: 700, marginTop: 4 }}>
                ✓ Deposit only — pay balance at property
              </div>
            )}
            {selectedRate.cancellationPolicyName && (
              <div style={{ fontSize: 11, color: "var(--bk-muted)", marginTop: 2 }}>
                {selectedRate.cancellationPolicyName}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSelect}
            style={{
              padding: "12px 24px",
              background: "var(--bk-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--bk-radius)",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              transition: "background .2s",
              flexShrink: 0,
            }}
          >
            Select →
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .bk-room-result { grid-template-columns: 1fr !important; }
          .bk-room-result > div:first-child { min-height: 160px !important; }
        }
      `}</style>
    </div>
  );
}

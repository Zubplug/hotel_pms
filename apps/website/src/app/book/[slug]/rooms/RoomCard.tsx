"use client";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

interface Props {
  room: {
    roomTypeId: string;
    roomTypeName: string;
    description?: string | null;
    amenities?: string[];
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

function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      animation: "modalFadeIn 0.3s ease-out"
    }} onClick={onClose}>
      <div style={{
        background: "var(--bk-surface)", border: "1px solid var(--bk-border)",
        borderRadius: "var(--bk-radius-lg)", width: "100%", maxWidth: "800px",
        maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--bk-shadow-lg)",
        position: "relative",
        animation: "modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          background: "rgba(0,0,0,0.5)", border: "none", color: "#fff",
          width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
          display: "grid", placeItems: "center", fontSize: 18,
          backdropFilter: "blur(4px)"
        }}>×</button>
        {children}
      </div>
      <style>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>,
    document.body
  );
}

export function RoomCard({ room, slug, checkIn, checkOut, adults, children, nights, paymentMode }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedRateIdx, setSelectedRateIdx] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const images = room.images ?? [];
  const amenities = room.amenities ?? [];
  const rates = room.rates ?? [];
  const selectedRate = rates[selectedRateIdx];
  const isBookable = room.availableRooms > 0 && Boolean(selectedRate);
  const availabilityLabel = room.availableRooms <= 0
    ? "Sold out"
    : !selectedRate
      ? "Pricing unavailable"
      : room.availableRooms <= 3
        ? `Only ${room.availableRooms} left`
        : null;

  const handleSelect = () => {
    const params = new URLSearchParams({
      checkIn, checkOut, adults, children,
      roomTypeId: room.roomTypeId,
      ratePlanId: selectedRate.ratePlanId,
    });
    startTransition(() => {
      router.push(`/book/${slug}/guest?${params}`);
    });
  };

  const fallbacks = [
    "/images/room-standard.png", "/images/room-deluxe.png",
    "/images/room-suite.png", "/images/room-family.png",
    "/images/room-view.png", "/images/default-room.png"
  ];
  const sum = room.roomTypeId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const fallbackImage = fallbacks[sum % fallbacks.length];
  const mainImage = images[0] || fallbackImage;

  return (
    <>
      <div className="bk-room-result">
        {/* Image Area */}
        <div 
          className="bk-room-image-area"
          style={{ backgroundImage: `url(${mainImage})` }}
          onClick={() => setIsModalOpen(true)}
        >
          <div className="bk-room-image-overlay">
            <span className="bk-view-details-btn">View Details</span>
          </div>
        </div>

        {/* Details Area */}
        <div className="bk-room-details">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 className="bk-room-title" onClick={() => setIsModalOpen(true)}>
                {room.roomTypeName}
              </h3>
              {room.description && (
                <p className="bk-room-desc">
                  {room.description}
                </p>
              )}
              {amenities.length > 0 && (
                <div className="bk-amenities-list" aria-label="Room amenities">
                  {amenities.slice(0, 3).map((amenity) => (
                    <span key={amenity} className="bk-amenity-tag">
                      {amenity}
                    </span>
                  ))}
                  {amenities.length > 3 && (
                    <span className="bk-amenity-tag bk-amenity-more" onClick={() => setIsModalOpen(true)}>
                      +{amenities.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <span className="bk-occupancy-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4}}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Max {room.maxOccupancy}
              </span>
              {availabilityLabel && (
                <div className={`bk-availability-badge ${room.availableRooms <= 0 ? 'sold-out' : 'low-stock'}`}>
                  {availabilityLabel}
                </div>
              )}
            </div>
          </div>

          {/* Rate Selection */}
          {rates.length > 1 && (
            <div className="bk-rate-tabs">
              {rates.map((rate, i) => (
                <button
                  key={rate.ratePlanId}
                  type="button"
                  onClick={() => setSelectedRateIdx(i)}
                  className={`bk-rate-tab ${i === selectedRateIdx ? 'active' : ''}`}
                >
                  {rate.ratePlanName}
                </button>
              ))}
            </div>
          )}

          {/* Pricing & CTA */}
          <div className="bk-room-footer">
            <div>
              {selectedRate ? (
                <>
                  <div className="bk-price-line">
                    <span className="bk-price-amount">
                      {fmtCurrency(selectedRate.nightlyRate, selectedRate.currency)}
                    </span>
                    <span className="bk-price-label">/ night</span>
                  </div>
                  <div className="bk-price-total">
                    Total: <strong>{fmtCurrency(selectedRate.totalAmount, selectedRate.currency)}</strong>
                    {" for "}{nights} night{nights !== 1 ? "s" : ""}
                  </div>
                  {paymentMode === "PAY_LATER" && (
                    <div className="bk-payment-msg success">✓ No payment required now</div>
                  )}
                  {paymentMode === "DEPOSIT" && (
                    <div className="bk-payment-msg highlight">✓ Deposit only — pay balance at property</div>
                  )}
                  {selectedRate.cancellationPolicyName && (
                    <div className="bk-cancel-msg">{selectedRate.cancellationPolicyName}</div>
                  )}
                </>
              ) : (
                <div className="bk-cancel-msg">Pricing is currently unavailable for these dates.</div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSelect}
              disabled={!isBookable}
              className={`bk-select-btn ${isBookable ? 'active' : 'disabled'}`}
            >
              {isBookable ? "Reserve" : "Unavailable"}
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        {/* Modal Header Image */}
        <div style={{ height: 320, backgroundImage: `url(${mainImage})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%", background: "linear-gradient(to top, var(--bk-surface), transparent)" }} />
          <div style={{ position: "absolute", bottom: 24, left: 32 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, letterSpacing: "-.03em", color: "var(--bk-text)", textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
              {room.roomTypeName}
            </h2>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <span style={{ fontSize: 12, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", padding: "4px 12px", borderRadius: 100, color: "#fff", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Max {room.maxOccupancy} Guests
              </span>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ padding: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 40 }}>
            <div>
              <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--bk-primary)", fontWeight: 700, marginBottom: 12 }}>About the Room</h4>
              <p style={{ fontSize: 15, color: "var(--bk-muted)", lineHeight: 1.7, marginBottom: 32 }}>
                {room.description || "A beautiful room ready for your stay."}
              </p>

              {amenities.length > 0 && (
                <>
                  <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--bk-primary)", fontWeight: 700, marginBottom: 16 }}>Amenities</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                    {amenities.map(am => (
                      <div key={am} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--bk-text)" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--bk-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        {am}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sidebar Pricing */}
            <div>
              <div style={{ background: "var(--bk-surface-raised)", borderRadius: "var(--bk-radius-lg)", padding: 24, border: "1px solid var(--bk-border)" }}>
                <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--bk-muted)", fontWeight: 700, marginBottom: 16 }}>Select Rate</h4>
                
                {rates.map((rate, i) => (
                  <div 
                    key={rate.ratePlanId}
                    onClick={() => setSelectedRateIdx(i)}
                    style={{
                      padding: 16, marginBottom: 12, borderRadius: "var(--bk-radius)",
                      border: `1px solid ${i === selectedRateIdx ? "var(--bk-primary)" : "var(--bk-border)"}`,
                      background: i === selectedRateIdx ? "var(--bk-primary-dim)" : "transparent",
                      cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: i === selectedRateIdx ? "var(--bk-primary)" : "var(--bk-text)" }}>{rate.ratePlanName}</span>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${i === selectedRateIdx ? "var(--bk-primary)" : "var(--bk-muted)"}`, display: "grid", placeItems: "center" }}>
                        {i === selectedRateIdx && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--bk-primary)" }} />}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--bk-text)", fontFamily: "var(--font-display)" }}>
                      {fmtCurrency(rate.nightlyRate, rate.currency)} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--bk-muted)" }}>/ night</span>
                    </div>
                    {rate.cancellationPolicyName && (
                      <div style={{ fontSize: 11, color: "var(--bk-muted)", marginTop: 6 }}>
                        {rate.cancellationPolicyName}
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--bk-border)" }}>
                   {selectedRate ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14, color: "var(--bk-muted)" }}>
                        <span>Total ({nights} nights)</span>
                        <strong style={{ color: "var(--bk-text)", fontSize: 18, fontFamily: "var(--font-display)" }}>{fmtCurrency(selectedRate.totalAmount, selectedRate.currency)}</strong>
                      </div>
                      <button
                        onClick={() => { setIsModalOpen(false); handleSelect(); }}
                        disabled={!isBookable}
                        className={`bk-select-btn ${isBookable ? 'active' : 'disabled'}`}
                        style={{ width: "100%", marginTop: 12 }}
                      >
                        {isBookable ? "Reserve Now" : "Unavailable"}
                      </button>
                    </>
                   ) : (
                    <div style={{ fontSize: 13, color: "var(--bk-muted)" }}>Pricing unavailable</div>
                   )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        .bk-room-result {
          background: var(--bk-surface);
          border: 1px solid var(--bk-border);
          border-radius: var(--bk-radius-lg);
          overflow: hidden;
          display: grid;
          grid-template-columns: 320px 1fr;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
        }
        .bk-room-result:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          border-color: color-mix(in srgb, var(--bk-primary) 30%, var(--bk-border));
        }

        .bk-room-image-area {
          background-position: center;
          background-size: cover;
          position: relative;
          cursor: pointer;
          min-height: 240px;
        }
        .bk-room-image-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.3);
          opacity: 0;
          transition: opacity 0.3s;
          display: grid;
          place-items: center;
        }
        .bk-room-image-area:hover .bk-room-image-overlay {
          opacity: 1;
        }
        .bk-view-details-btn {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          transform: translateY(10px);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bk-room-image-area:hover .bk-view-details-btn {
          transform: translateY(0);
        }

        .bk-room-details {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .bk-room-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 22px;
          letter-spacing: -.02em;
          color: var(--bk-text);
          margin-bottom: 8px;
          cursor: pointer;
          transition: color 0.2s;
        }
        .bk-room-title:hover {
          color: var(--bk-primary);
        }
        .bk-room-desc {
          font-size: 14px;
          color: var(--bk-muted);
          line-height: 1.6;
          max-width: 480px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .bk-amenities-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .bk-amenity-tag {
          font-size: 11px;
          background: var(--bk-surface-raised);
          border: 1px solid var(--bk-border);
          border-radius: 6px;
          padding: 4px 10px;
          color: var(--bk-text);
          font-weight: 500;
        }
        .bk-amenity-more {
          cursor: pointer;
          color: var(--bk-primary);
          background: var(--bk-primary-dim);
          border-color: transparent;
        }
        .bk-amenity-more:hover {
          background: color-mix(in srgb, var(--bk-primary) 20%, transparent);
        }

        .bk-occupancy-badge {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          background: var(--bk-surface-raised);
          border-radius: 8px;
          padding: 6px 12px;
          color: var(--bk-text);
          font-weight: 600;
        }
        .bk-availability-badge {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .bk-availability-badge.sold-out {
          background: rgba(248,113,113,.12);
          color: #fca5a5;
        }
        .bk-availability-badge.low-stock {
          background: rgba(251,191,36,.12);
          color: #fbbf24;
        }

        .bk-rate-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .bk-rate-tab {
          padding: 6px 14px;
          border-radius: 100px;
          border: 1px solid var(--bk-border);
          background: transparent;
          color: var(--bk-muted);
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          font-family: var(--font-body);
          transition: all 0.2s;
        }
        .bk-rate-tab:hover {
          background: var(--bk-surface-raised);
          color: var(--bk-text);
        }
        .bk-rate-tab.active {
          border-color: var(--bk-primary);
          background: var(--bk-primary-dim);
          color: var(--bk-primary);
        }

        .bk-room-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid var(--bk-border);
          gap: 20px;
        }
        .bk-price-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .bk-price-amount {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 28px;
          letter-spacing: -.03em;
          color: var(--bk-text);
        }
        .bk-price-label {
          font-size: 13px;
          color: var(--bk-muted);
        }
        .bk-price-total {
          font-size: 13px;
          color: var(--bk-muted);
          margin-top: 4px;
        }
        .bk-price-total strong {
          color: var(--bk-text);
        }
        .bk-payment-msg {
          font-size: 12px;
          font-weight: 600;
          margin-top: 6px;
        }
        .bk-payment-msg.success { color: #4ade80; }
        .bk-payment-msg.highlight { color: var(--bk-primary); }
        .bk-cancel-msg {
          font-size: 12px;
          color: var(--bk-muted);
          margin-top: 4px;
        }

        .bk-select-btn {
          padding: 0 32px;
          height: 48px;
          border-radius: var(--bk-radius);
          border: none;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 15px;
          letter-spacing: -.01em;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .bk-select-btn.active {
          background: var(--bk-primary);
          color: #000;
          cursor: pointer;
        }
        .bk-select-btn.active:hover {
          background: var(--bk-primary-hover);
          transform: translateY(-1px);
        }
        .bk-select-btn.disabled {
          background: var(--bk-surface-raised);
          color: var(--bk-muted);
          cursor: not-allowed;
        }

        @media (max-width: 800px) {
          .bk-room-result { grid-template-columns: 1fr; }
          .bk-room-image-area { min-height: 220px; }
          .bk-room-details { padding: 24px; }
        }
        @media (max-width: 600px) {
          .bk-room-footer { flex-direction: column; align-items: stretch; gap: 16px; }
          .bk-select-btn { width: 100%; }
        }
      `}</style>
    </>
  );
}

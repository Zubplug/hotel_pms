"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  roomTypeId?: string;
  config: {
    minStay: number;
    maxStay: number | null;
    bookingLeadTimeHours: number;
    maxAdvanceDays: number | null;
    paymentMode: string;
  };
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function DateSearchForm({ slug, roomTypeId, config }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Defaults
  const minCheckin = config.bookingLeadTimeHours
    ? addDays(today(), Math.ceil(config.bookingLeadTimeHours / 24))
    : today();

  const [checkIn, setCheckIn] = useState(minCheckin);
  const [checkOut, setCheckOut] = useState(addDays(minCheckin, config.minStay));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const nights = diffDays(checkIn, checkOut);

  const handleSearch = () => {
    setError(null);
    if (checkOut <= checkIn) { setError("Check-out must be after check-in"); return; }
    if (nights < config.minStay) { setError(`Minimum stay is ${config.minStay} night${config.minStay > 1 ? "s" : ""}`); return; }
    if (config.maxStay && nights > config.maxStay) { setError(`Maximum stay is ${config.maxStay} nights`); return; }
      startTransition(() => {
        const params = new URLSearchParams({ checkIn, checkOut, adults: String(adults), children: String(children) });
        if (roomTypeId) params.set("roomTypeId", roomTypeId);
        router.push(`/book/${slug}/rooms?${params.toString()}`);
      });
  };

  return (
    <div id="booking-search" style={{ width: "100%", maxWidth: "1160px", margin: "0 auto" }}>
      <div className="bk-search-container">
        <div className="bk-search-item">
          <label className="bk-search-label">Check-in</label>
          <input
            type="date"
            value={checkIn}
            min={minCheckin}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, config.minStay));
            }}
            className="bk-search-input"
          />
        </div>
        
        <div className="bk-search-divider" />

        <div className="bk-search-item">
          <label className="bk-search-label">Check-out</label>
          <input
            type="date"
            value={checkOut}
            min={addDays(checkIn, config.minStay)}
            onChange={(e) => setCheckOut(e.target.value)}
            className="bk-search-input"
          />
        </div>

        <div className="bk-search-divider" />

        <div className="bk-search-item" style={{ flex: 1.2 }}>
          <label className="bk-search-label">Guests</label>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "var(--bk-muted)" }}>Adults</span>
              <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="bk-counter-btn">−</button>
              <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--bk-text)", minWidth: "16px", textAlign: "center", fontFamily: "var(--font-display)" }}>{adults}</span>
              <button type="button" onClick={() => setAdults(adults + 1)} className="bk-counter-btn">+</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "13px", color: "var(--bk-muted)" }}>Children</span>
              <button type="button" onClick={() => setChildren(Math.max(0, children - 1))} className="bk-counter-btn">−</button>
              <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--bk-text)", minWidth: "16px", textAlign: "center", fontFamily: "var(--font-display)" }}>{children}</span>
              <button type="button" onClick={() => setChildren(children + 1)} className="bk-counter-btn">+</button>
            </div>
          </div>
        </div>

        <button type="button" onClick={handleSearch} className="bk-search-btn">
          Search Rooms
        </button>
      </div>

      {nights > 0 && !error && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--bk-primary-dim)", color: "var(--bk-text)",
            border: "1px solid var(--bk-primary-dim)",
            borderRadius: 999, padding: "6px 16px", fontSize: 11, fontWeight: 600,
            letterSpacing: ".02em",
          }}>
            <span style={{ color: "var(--bk-primary)" }}>✦</span>
            {nights} night{nights !== 1 ? "s" : ""} · {adults} adult{adults !== 1 ? "s" : ""}
            {children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : ""}
          </span>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--bk-radius)", fontSize: 13, color: "#ef4444", textAlign: "center" }}>
          {error}
        </div>
      )}

      <style>{`
        .bk-search-container {
          background: var(--bk-surface);
          border: 1px solid var(--bk-border);
          border-radius: 100px;
          padding: 10px;
          display: flex;
          align-items: center;
          box-shadow: 0 16px 40px rgba(0,0,0,0.3);
          position: relative;
          z-index: 10;
        }
        .bk-search-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 8px 24px;
          min-width: 0;
        }
        .bk-search-divider {
          width: 1px;
          height: 44px;
          background: var(--bk-border);
        }
        .bk-search-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--bk-muted);
          text-transform: uppercase;
          letter-spacing: .08em;
          margin-bottom: 6px;
          font-family: var(--font-mono);
        }
        .bk-search-input {
          width: 100%;
          background: transparent;
          border: none;
          color: var(--bk-text);
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }
        .bk-search-input::-webkit-calendar-picker-indicator {
          filter: invert(1) opacity(0.5);
          cursor: pointer;
        }
        .bk-counter-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid var(--bk-border);
          background: rgba(255,255,255,0.03);
          color: var(--bk-text);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s, border-color 0.2s;
        }
        .bk-counter-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: var(--bk-muted);
        }
        .bk-search-btn {
          padding: 0 40px;
          height: 56px;
          border-radius: 100px;
          background: var(--bk-primary);
          color: #000;
          border: none;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 15px;
          letter-spacing: -.02em;
          cursor: pointer;
          white-space: nowrap;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.2s;
        }
        .bk-search-btn:hover {
          background: var(--bk-primary-hover);
          transform: scale(1.02);
        }
        .bk-search-btn:active {
          transform: scale(0.98);
        }

        @media (max-width: 900px) {
          .bk-search-container {
            flex-direction: column;
            border-radius: var(--bk-radius-lg);
            padding: 16px;
            gap: 16px;
          }
          .bk-search-divider {
            width: 100%;
            height: 1px;
            margin: 0;
          }
          .bk-search-item {
            width: 100%;
            padding: 0;
          }
          .bk-search-btn {
            width: 100%;
            border-radius: var(--bk-radius);
          }
        }
      `}</style>
    </div>
  );
}

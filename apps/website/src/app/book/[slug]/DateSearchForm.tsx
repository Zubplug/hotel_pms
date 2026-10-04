"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";


interface Props {
  slug: string;
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

export function DateSearchForm({ slug, config }: Props) {
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
      router.push(`/book/${slug}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`);
    });
  };

  return (
    <div id="booking-search">
      <div
        style={{
          background: "var(--bk-surface)",
          borderRadius: "var(--bk-radius-lg)",
          boxShadow: "var(--bk-shadow-lg)",
          border: "1px solid var(--bk-border)",
          padding: "32px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
          gap: 12,
          alignItems: "end",
        }}
        className="bk-search-grid"
      >
        {/* Check-in */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Check-in
          </label>
          <input
            type="date"
            value={checkIn}
            min={minCheckin}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, config.minStay));
            }}
            style={{
              width: "100%", padding: "12px 14px", fontSize: 15, fontWeight: 600,
              border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)",
              background: "var(--bk-bg)", color: "var(--bk-text)", outline: "none",
              cursor: "pointer", fontFamily: "var(--font-body)",
            }}
          />
        </div>

        {/* Check-out */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Check-out
          </label>
          <input
            type="date"
            value={checkOut}
            min={addDays(checkIn, config.minStay)}
            onChange={(e) => setCheckOut(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", fontSize: 15, fontWeight: 600,
              border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)",
              background: "var(--bk-bg)", color: "var(--bk-text)", outline: "none",
              cursor: "pointer", fontFamily: "var(--font-body)",
            }}
          />
        </div>

        {/* Adults */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Adults
          </label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)", background: "var(--bk-bg)", overflow: "hidden" }}>
            <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))}
              style={{ width: 44, height: 48, fontSize: 20, color: "var(--bk-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>−</button>
            <span style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 16, color: "var(--bk-text)" }}>{adults}</span>
            <button type="button" onClick={() => setAdults(adults + 1)}
              style={{ width: 44, height: 48, fontSize: 20, color: "var(--bk-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>+</button>
          </div>
        </div>

        {/* Children */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Children
          </label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)", background: "var(--bk-bg)", overflow: "hidden" }}>
            <button type="button" onClick={() => setChildren(Math.max(0, children - 1))}
              style={{ width: 44, height: 48, fontSize: 20, color: "var(--bk-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>−</button>
            <span style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 16, color: "var(--bk-text)" }}>{children}</span>
            <button type="button" onClick={() => setChildren(children + 1)}
              style={{ width: 44, height: 48, fontSize: 20, color: "var(--bk-muted)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>+</button>
          </div>
        </div>

        {/* Search CTA */}
        <button
          type="button"
          onClick={handleSearch}
          style={{
            padding: "0 28px", height: 50, borderRadius: "var(--bk-radius)",
            background: "var(--bk-primary)", color: "#fff", border: "none",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
            cursor: "pointer", whiteSpace: "nowrap",
            transition: "background .2s, box-shadow .2s",
          }}
          onMouseOver={e => (e.currentTarget.style.background = "var(--bk-primary-hover)")}
          onMouseOut={e => (e.currentTarget.style.background = "var(--bk-primary)")}
        >
          Search Rooms →
        </button>
      </div>

      {/* Stay summary chip */}
      {nights > 0 && !error && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--bk-primary-dim)", color: "var(--bk-primary)",
            border: "1px solid color-mix(in srgb, var(--bk-primary) 30%, transparent)",
            borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700,
          }}>
            {nights} night{nights !== 1 ? "s" : ""} · {adults} adult{adults !== 1 ? "s" : ""}
            {children > 0 ? ` · ${children} child${children !== 1 ? "ren" : ""}` : ""}
          </span>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--bk-radius)", fontSize: 13, color: "#dc2626" }}>
          {error}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .bk-search-grid { grid-template-columns: 1fr 1fr !important; }
          .bk-search-grid > *:last-child { grid-column: 1 / -1; }
        }
        @media (max-width: 480px) {
          .bk-search-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

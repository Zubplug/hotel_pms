"use client";

import { useState } from "react";

export function BookingEngineSetupButton({ propertyId, entitled, configured }: { propertyId: string; entitled: boolean; configured: boolean }) {
  const [open, setOpen] = useState(false);

  if (entitled) {
    return (
      <a href={`/portal/settings/booking-engine/${propertyId}`} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
        {configured ? "Configure →" : "Set up →"}
      </a>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" style={{ flexShrink: 0 }} onClick={() => setOpen(true)}>
        {configured ? "Configure →" : "Set up →"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`booking-addon-title-${propertyId}`}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(3, 12, 20, .68)" }}
        >
          <div className="portal-card" onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 430px)", padding: 24, border: "1px solid rgba(255,190,90,.45)", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 24, marginBottom: 10 }}>🌐</div>
                <h2 id={`booking-addon-title-${propertyId}`} style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                  Booking Engine add-on required
                </h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={{ border: 0, background: "transparent", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.7, color: "var(--text-muted)" }}>
              This property does not have an active Booking Engine add-on. Subscribe to the add-on before setting up your online booking site.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <a href="/portal/subscription" className="btn btn-primary btn-sm">View subscription options →</a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

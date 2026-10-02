import prisma from "@hotel-pms/db";
import Link from "next/link";
import { ManageBookingActions } from "./ManageBookingActions";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const CANCELLABLE_STATUSES = ["CONFIRMED", "TENTATIVE"];

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string; email?: string }>;
}) {
  const { slug } = await params;
  const { ref, email } = await searchParams;

  let reservation: any = null;
  let lookupError: string | null = null;

  if (ref && email) {
    reservation = await prisma.reservation.findFirst({
      where: {
        confirmationNumber: ref,
        primaryGuest: { email: email.toLowerCase() },
        source: "WEBSITE",
        property: { bookingEngineConfig: { publicSlug: slug } },
      },
      include: {
        primaryGuest: { select: { firstName: true, lastName: true, email: true } },
        reservationRooms: {
          take: 1,
        },
        property: { select: { name: true, phone: true, email: true } },
        folios: { where: { type: "ROOM" }, select: { balance: true, currency: true } },
      },
    });
    if (!reservation) lookupError = "No booking found with those details. Check your confirmation number and email address.";
  }

  const canCancel = reservation
    ? ["CONFIRMED", "PENDING"].includes(reservation.status)
    : false;

  const room = reservation?.reservationRooms?.[0];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href={`/book/${slug}`} style={{ fontSize: 12, color: "var(--bk-primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 24 }}>
        ← Back to home
      </Link>

      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(1.6rem, 3.5vw, 2rem)", letterSpacing: "-.05em", color: "var(--bk-text)", marginBottom: 6 }}>
        Manage Your Booking
      </h1>
      <p style={{ fontSize: 14, color: "var(--bk-muted)", marginBottom: 28 }}>
        Enter your confirmation number and email to view or cancel your reservation.
      </p>

      {/* ── LOOKUP FORM ─────────────────────────────────────── */}
      {!reservation && (
        <form method="GET" style={{ display: "flex", flexDirection: "column", gap: 16, background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)", padding: "28px" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Confirmation Number
            </label>
            <input
              type="text" name="ref" defaultValue={ref ?? ""}
              placeholder="e.g. WEB-2026-00001"
              required
              style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: "var(--font-mono)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)", background: "var(--bk-bg)", color: "var(--bk-text)", outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-muted)", letterSpacing: ".06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email" name="email" defaultValue={email ?? ""}
              placeholder="The email used at booking"
              required
              style={{ width: "100%", padding: "11px 14px", fontSize: 14, border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)", background: "var(--bk-bg)", color: "var(--bk-text)", outline: "none" }}
            />
          </div>

          {lookupError && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
              {lookupError}
            </div>
          )}

          <button
            type="submit"
            style={{
              padding: "12px 24px", background: "var(--bk-primary)", color: "#fff", border: "none",
              borderRadius: "var(--bk-radius)", fontFamily: "var(--font-display)", fontWeight: 700,
              fontSize: 14, cursor: "pointer",
            }}
          >
            Find My Booking →
          </button>
        </form>
      )}

      {/* ── BOOKING FOUND ───────────────────────────────────── */}
      {reservation && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Status banner */}
          <div style={{
            padding: "14px 20px",
            background: reservation.status === "CHECKED_OUT" || reservation.status === "CANCELLED"
              ? "#f8fafc" : "#f0fdf4",
            border: `1px solid ${reservation.status === "CANCELLED" ? "#fecaca" : reservation.status === "CHECKED_OUT" ? "var(--bk-border)" : "#86efac"}`,
            borderRadius: "var(--bk-radius)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--bk-text)" }}>
              {reservation.confirmationNumber}
            </div>
            <span style={{
              padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: reservation.status === "CONFIRMED" ? "#dcfce7" : reservation.status === "CANCELLED" ? "#fee2e2" : "#f1f5f9",
              color: reservation.status === "CONFIRMED" ? "#15803d" : reservation.status === "CANCELLED" ? "#dc2626" : "var(--bk-muted)",
            }}>
              {reservation.status}
            </span>
          </div>

          {/* Details */}
          <div style={{ background: "var(--bk-surface)", border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius-lg)", overflow: "hidden" }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--bk-border)", background: "#fafbfc" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--bk-text)" }}>Reservation Details</h2>
            </div>
            <div style={{ padding: "18px 22px" }}>
              {[
                { label: "Guest", value: `${reservation.primaryGuest?.firstName} ${reservation.primaryGuest?.lastName}` },
                { label: "Property", value: reservation.property.name },
                { label: "Room", value: reservation.ratePlanSnapshot?.roomTypeName ?? "—" },
                { label: "Rate plan", value: reservation.ratePlanSnapshot?.ratePlanName ?? "—" },
                { label: "Check-in", value: fmtDate(reservation.checkIn) },
                { label: "Check-out", value: fmtDate(reservation.checkOut) },
                { label: "Guests", value: `${reservation.adults} adult${reservation.adults !== 1 ? "s" : ""}${reservation.children > 0 ? `, ${reservation.children} children` : ""}` },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bk-border)", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--bk-muted)" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--bk-text)", textAlign: "right" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel actions */}
          <ManageBookingActions
            slug={slug}
            confirmationNumber={reservation.confirmationNumber}
            canCancel={canCancel}
            cancelTokenAvailable={!!reservation.guestCancellationTokenHash}
          />

          {/* Property contact */}
          <div style={{ fontSize: 13, color: "var(--bk-muted)", padding: "14px 0" }}>
            Need help?{" "}
            {reservation.property.phone && (
              <a href={`tel:${reservation.property.phone}`} style={{ color: "var(--bk-primary)" }}>
                {reservation.property.phone}
              </a>
            )}
            {reservation.property.phone && reservation.property.email && " · "}
            {reservation.property.email && (
              <a href={`mailto:${reservation.property.email}`} style={{ color: "var(--bk-primary)" }}>
                {reservation.property.email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { createHash } from "crypto";
import prisma from "@hotel-pms/db";

export const dynamic = "force-dynamic";

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount / 100);
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  // Verify token — DB stores SHA-256 hash
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const reservation = await prisma.reservation.findFirst({
    where: {
      guestConfirmationTokenHash: tokenHash,
      source: "WEBSITE",
      property: { bookingEngineConfig: { publicSlug: slug } },
    },
    include: {
      primaryGuest: { select: { firstName: true, lastName: true, email: true } },
      reservationRooms: {
        take: 1,
      },
      property: { select: { name: true, address: true, phone: true, email: true } },
      folios: {
        where: { type: "ROOM" },
        include: {
          payments: {
            select: { amount: true, status: true, method: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  }) as any;

  if (!reservation) notFound();

  const room = reservation.reservationRooms?.[0];
  const folio = reservation.folios?.[0];
  const latestPayment = folio?.payments?.[0];
  const isPaid = latestPayment?.status === "COMPLETED";


  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 0" }}>
      {/* ── SUCCESS HEADER ─────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#f0fdf4", border: "2px solid #86efac",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, margin: "0 auto 16px",
          }}
        >
          ✓
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
            letterSpacing: "-.05em", color: "var(--bk-text)",
            marginBottom: 10,
          }}
        >
          Booking Confirmed!
        </h1>
        <p style={{ fontSize: 15, color: "var(--bk-muted)" }}>
          Thank you, {reservation.primaryGuest?.firstName}. Your reservation is confirmed.
          A confirmation has been sent to{" "}
          <strong style={{ color: "var(--bk-text)" }}>{reservation.primaryGuest?.email}</strong>.
        </p>
      </div>

      {/* ── CONFIRMATION NUMBER ──────────────────────────────── */}
      <div
        style={{
          background: "var(--bk-primary-dim)",
          border: "1px solid color-mix(in srgb, var(--bk-primary) 30%, transparent)",
          borderRadius: "var(--bk-radius-lg)",
          padding: "20px 28px",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--bk-primary)", marginBottom: 8 }}>
          Confirmation Number
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 800, fontSize: "2rem",
            letterSpacing: ".08em", color: "var(--bk-text)",
          }}
        >
          {reservation.confirmationNumber}
        </div>
        <p style={{ fontSize: 12, color: "var(--bk-muted)", marginTop: 8 }}>
          Keep this number — you'll need it to manage your booking.
        </p>
      </div>

      {/* ── BOOKING DETAILS ─────────────────────────────────── */}
      <div
        style={{
          background: "var(--bk-surface)",
          border: "1px solid var(--bk-border)",
          borderRadius: "var(--bk-radius-lg)",
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--bk-border)", background: "#fafbfc" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "-.03em", color: "var(--bk-text)" }}>
            Booking Details
          </h2>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {[
            { label: "Property", value: reservation.property.name },
            { label: "Room type", value: reservation.ratePlanSnapshot?.roomTypeName ?? "—" },
            { label: "Rate plan", value: reservation.ratePlanSnapshot?.ratePlanName ?? "—" },
            { label: "Check-in", value: fmtDate(reservation.checkIn) },
            { label: "Check-out", value: fmtDate(reservation.checkOut) },
            {
              label: "Guests",
              value: `${reservation.adults} adult${reservation.adults !== 1 ? "s" : ""}${reservation.children > 0 ? `, ${reservation.children} child${reservation.children !== 1 ? "ren" : ""}` : ""}`,
            },
            { label: "Status", value: reservation.status },
            ...(folio ? [{ label: "Total", value: fmtCurrency(Number(folio.balance) + (latestPayment ? Number(latestPayment.amount) : 0), folio.currency ?? "NGN") }] : []),
            ...(isPaid ? [{ label: "Payment", value: `Paid — ${latestPayment?.method ?? ""}` }] : [{ label: "Payment", value: "Due at property" }]),
          ].map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--bk-border)", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--bk-muted)" }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--bk-text)", textAlign: "right" }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── PROPERTY CONTACT ─────────────────────────────────── */}
      {(reservation.property.phone || reservation.property.email || reservation.property.address) && (
        <div
          style={{
            background: "var(--bk-surface)",
            border: "1px solid var(--bk-border)",
            borderRadius: "var(--bk-radius-lg)",
            padding: "20px 24px",
            marginBottom: 20,
            fontSize: 13,
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--bk-text)", marginBottom: 12 }}>
            Property Contact
          </div>
          {reservation.property.address && (
            <div style={{ color: "var(--bk-muted)", marginBottom: 6 }}>📍 {reservation.property.address}</div>
          )}
          {reservation.property.phone && (
            <div style={{ color: "var(--bk-muted)", marginBottom: 6 }}>
              📞 <a href={`tel:${reservation.property.phone}`} style={{ color: "var(--bk-primary)" }}>{reservation.property.phone}</a>
            </div>
          )}
          {reservation.property.email && (
            <div style={{ color: "var(--bk-muted)" }}>
              ✉️ <a href={`mailto:${reservation.property.email}`} style={{ color: "var(--bk-primary)" }}>{reservation.property.email}</a>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIONS ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href={`/book/${slug}/manage?ref=${reservation.confirmationNumber}&email=${encodeURIComponent(reservation.primaryGuest?.email ?? "")}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 20px", background: "var(--bk-surface)",
            border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
            color: "var(--bk-text)", textDecoration: "none",
          }}
        >
          Manage Booking →
        </Link>
        <Link
          href={`/book/${slug}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "11px 20px", background: "transparent",
            border: "1px solid var(--bk-border)", borderRadius: "var(--bk-radius)",
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
            color: "var(--bk-muted)", textDecoration: "none",
          }}
        >
          Book another room
        </Link>
      </div>
    </div>
  );
}

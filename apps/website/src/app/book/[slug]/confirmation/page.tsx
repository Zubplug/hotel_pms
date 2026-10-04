import { notFound } from "next/navigation";
import Link from "next/link";
import { createHash } from "crypto";
import prisma from "@hotel-pms/db";

export const dynamic = "force-dynamic";

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
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
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }} className="bk-success-page">
      {/* ── SUCCESS HEADER ─────────────────────────────────── */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div
          style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "color-mix(in srgb, var(--bk-primary) 15%, transparent)",
            border: "2px solid color-mix(in srgb, var(--bk-primary) 40%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px", color: "var(--bk-primary)",
            boxShadow: "0 0 40px color-mix(in srgb, var(--bk-primary) 20%, transparent)",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800, fontSize: "clamp(2rem, 5vw, 2.8rem)",
            letterSpacing: "-.04em", color: "var(--bk-text)",
            marginBottom: 16,
          }}
        >
          Booking Confirmed
        </h1>
        <p style={{ fontSize: 16, color: "var(--bk-muted)", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
          Thank you, {reservation.primaryGuest?.firstName}. Your reservation is confirmed.
          A confirmation email has been sent to{" "}
          <strong style={{ color: "var(--bk-text)" }}>{reservation.primaryGuest?.email}</strong>.
        </p>
      </div>

      <div className="bk-success-card">
        {/* ── CONFIRMATION NUMBER ──────────────────────────────── */}
        <div className="bk-ref-header">
          <div className="bk-ref-label">Confirmation Number</div>
          <div className="bk-ref-number">{reservation.confirmationNumber}</div>
        </div>

        {/* ── BOOKING DETAILS ─────────────────────────────────── */}
        <div className="bk-details-grid">
          <div className="bk-detail-group">
            <div className="bk-detail-label">Check-in</div>
            <div className="bk-detail-value">{fmtDate(reservation.checkIn)}</div>
            <div className="bk-detail-sub">After 14:00</div>
          </div>
          <div className="bk-detail-group">
            <div className="bk-detail-label">Check-out</div>
            <div className="bk-detail-value">{fmtDate(reservation.checkOut)}</div>
            <div className="bk-detail-sub">Before 11:00</div>
          </div>
          <div className="bk-detail-group">
            <div className="bk-detail-label">Guests</div>
            <div className="bk-detail-value">
              {reservation.adults} Adult{reservation.adults !== 1 ? "s" : ""}
            </div>
            {reservation.children > 0 && (
              <div className="bk-detail-sub">{reservation.children} Child{reservation.children !== 1 ? "ren" : ""}</div>
            )}
          </div>
        </div>

        <div className="bk-divider"></div>

        {/* ── SUMMARY ─────────────────────────────────── */}
        <div className="bk-summary-list">
          <div className="bk-summary-row">
            <span className="bk-summary-label">Property</span>
            <span className="bk-summary-value">{reservation.property.name}</span>
          </div>
          <div className="bk-summary-row">
            <span className="bk-summary-label">Room Type</span>
            <span className="bk-summary-value">{reservation.ratePlanSnapshot?.roomTypeName ?? "—"}</span>
          </div>
          <div className="bk-summary-row">
            <span className="bk-summary-label">Rate Plan</span>
            <span className="bk-summary-value">{reservation.ratePlanSnapshot?.ratePlanName ?? "—"}</span>
          </div>
          <div className="bk-summary-row">
            <span className="bk-summary-label">Guest Name</span>
            <span className="bk-summary-value">{reservation.primaryGuest?.firstName} {reservation.primaryGuest?.lastName}</span>
          </div>
          <div className="bk-summary-row">
            <span className="bk-summary-label">Payment Status</span>
            <span className={`bk-summary-value bk-status-${isPaid ? 'paid' : 'unpaid'}`}>
              {isPaid ? `Paid (${latestPayment?.method ?? ""})` : "Due at property"}
            </span>
          </div>
          {folio && (
            <div className="bk-summary-row bk-summary-total">
              <span className="bk-summary-label">Total Amount</span>
              <span className="bk-summary-value">{fmtCurrency(Number(folio.balance) + (latestPayment ? Number(latestPayment.amount) : 0), folio.currency ?? "NGN")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTIONS ─────────────────────────────────────────── */}
      <div className="bk-actions-bar hide-print">
        <Link
          href={`/book/${slug}/manage?ref=${reservation.confirmationNumber}&email=${encodeURIComponent(reservation.primaryGuest?.email ?? "")}`}
          className="bk-action-btn bk-btn-primary"
        >
          Manage Booking
        </Link>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
          className="bk-action-btn bk-btn-secondary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:8}}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print Receipt
        </button>
      </div>

      {/* ── PROPERTY CONTACT ─────────────────────────────────── */}
      {(reservation.property.phone || reservation.property.email || reservation.property.address) && (
        <div className="bk-contact-card hide-print">
          <div className="bk-contact-title">Property Contact</div>
          <div className="bk-contact-links">
            {reservation.property.address && (
              <span>📍 {reservation.property.address}</span>
            )}
            {reservation.property.phone && (
              <span>📞 <a href={`tel:${reservation.property.phone}`}>{reservation.property.phone}</a></span>
            )}
            {reservation.property.email && (
              <span>✉️ <a href={`mailto:${reservation.property.email}`}>{reservation.property.email}</a></span>
            )}
          </div>
        </div>
      )}

      <style>{`
        .bk-success-card {
          background: var(--bk-surface);
          border: 1px solid var(--bk-border);
          border-radius: var(--bk-radius-lg);
          overflow: hidden;
          box-shadow: var(--bk-shadow-lg);
          margin-bottom: 24px;
        }

        .bk-ref-header {
          background: color-mix(in srgb, var(--bk-primary) 8%, var(--bk-surface));
          padding: 32px;
          text-align: center;
          border-bottom: 1px dashed var(--bk-border);
        }
        .bk-ref-label {
          font-size: 11px;
          font-family: var(--font-mono);
          letter-spacing: .2em;
          text-transform: uppercase;
          color: var(--bk-primary);
          margin-bottom: 8px;
          font-weight: 700;
        }
        .bk-ref-number {
          font-family: var(--font-mono);
          font-weight: 800;
          font-size: clamp(2rem, 6vw, 3rem);
          letter-spacing: .1em;
          color: var(--bk-text);
        }

        .bk-details-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          padding: 32px;
          gap: 24px;
        }
        .bk-detail-group {
          display: flex;
          flex-direction: column;
        }
        .bk-detail-label {
          font-size: 11px;
          font-family: var(--font-mono);
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--bk-muted);
          margin-bottom: 8px;
        }
        .bk-detail-value {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--bk-text);
          margin-bottom: 4px;
        }
        .bk-detail-sub {
          font-size: 12px;
          color: var(--bk-muted);
        }

        .bk-divider {
          height: 1px;
          background: var(--bk-border);
          margin: 0 32px;
        }

        .bk-summary-list {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .bk-summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .bk-summary-label {
          font-size: 14px;
          color: var(--bk-muted);
        }
        .bk-summary-value {
          font-size: 15px;
          font-weight: 600;
          color: var(--bk-text);
          text-align: right;
        }
        .bk-status-paid {
          color: #4ade80;
        }
        .bk-status-unpaid {
          color: var(--bk-primary);
        }
        .bk-summary-total {
          margin-top: 8px;
          padding-top: 16px;
          border-top: 1px dashed var(--bk-border);
        }
        .bk-summary-total .bk-summary-label {
          font-weight: 700;
          color: var(--bk-text);
        }
        .bk-summary-total .bk-summary-value {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -.03em;
        }

        .bk-actions-bar {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .bk-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 48px;
          padding: 0 24px;
          border-radius: var(--bk-radius);
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bk-btn-primary {
          background: var(--bk-primary);
          color: #000;
          border: none;
        }
        .bk-btn-primary:hover {
          background: var(--bk-primary-hover);
          transform: translateY(-2px);
        }
        .bk-btn-secondary {
          background: transparent;
          color: var(--bk-text);
          border: 1px solid var(--bk-border);
        }
        .bk-btn-secondary:hover {
          background: var(--bk-surface);
        }

        .bk-contact-card {
          background: var(--bk-surface);
          border: 1px solid var(--bk-border);
          border-radius: var(--bk-radius-lg);
          padding: 24px;
          text-align: center;
        }
        .bk-contact-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
          color: var(--bk-text);
          margin-bottom: 16px;
        }
        .bk-contact-links {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 24px;
          font-size: 13px;
          color: var(--bk-muted);
        }
        .bk-contact-links a {
          color: var(--bk-primary);
          text-decoration: none;
        }

        @media (max-width: 640px) {
          .bk-details-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .bk-actions-bar {
            flex-direction: column;
          }
          .bk-action-btn {
            width: 100%;
          }
          .bk-contact-links {
            flex-direction: column;
            gap: 12px;
          }
        }

        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .hide-print {
            display: none !important;
          }
          .bk-success-card {
            border: 2px solid #000 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .bk-ref-header {
            background: #f8f8f8 !important;
            border-bottom: 2px solid #000 !important;
          }
          .bk-ref-label, .bk-ref-number, .bk-detail-label, .bk-detail-value, .bk-detail-sub, .bk-summary-label, .bk-summary-value {
            color: #000 !important;
          }
          .bk-divider {
            background: #000 !important;
          }
          .bk-summary-total {
            border-top: 2px dashed #000 !important;
          }
        }
      `}</style>
    </div>
  );
}

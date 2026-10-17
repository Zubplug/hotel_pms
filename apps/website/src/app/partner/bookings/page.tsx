import Link from "next/link";
import prisma from "@hotel-pms/db";
import { PartnerShell } from "@/components/partner-shell";
import { getPartnerProperties, getPartnerWalletBalance, requirePartnerPortal } from "@/lib/partner-portal";

const STATUS_OPTS = ["ALL", "PENDING", "CONFIRMED", "FULFILLED", "CANCELLED", "REFUNDED"] as const;

export default async function PartnerBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const partner = await requirePartnerPortal();
  const query = await searchParams;
  const page     = Math.max(1, Number(query?.page) || 1);
  const pageSize = 25;
  const q        = (query?.q || "").trim().toLowerCase();
  const status   = STATUS_OPTS.includes(query?.status as any) && query?.status !== "ALL"
    ? (query?.status as string)
    : undefined;

  const [{ propertyIds, scope }, wallet] = await Promise.all([
    getPartnerProperties(partner.id, partner.organizationId),
    getPartnerWalletBalance(partner.id),
  ]);

  const where = {
    ...scope,
    propertyId: { in: propertyIds },
    ...(status ? { status } : {}),
  };

  const [total, bookings] = await Promise.all([
    prisma.referralBooking.count({ where }),
    prisma.referralBooking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        property: { select: { name: true, city: true } },
        campaign: { select: { name: true } },
        commission: { select: { status: true, amount: true, currency: true } },
      },
    }),
  ]);

  /* Client-side text filter on ref or property name */
  const filtered = q
    ? bookings.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          b.property.name.toLowerCase().includes(q) ||
          b.campaign?.name?.toLowerCase().includes(q)
      )
    : bookings;

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const searchUrl = (extra: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      page: "1",
      ...extra,
    });
    return `/partner/bookings?${p.toString()}`;
  };

  return (
    <PartnerShell
      partner={partner}
      availableBalance={Number(wallet?.availableBalance || 0)}
      currency={wallet?.currency || "NGN"}
    >
      <div className="reach-page-head">
        <div>
          <span className="reach-eyebrow">Performance</span>
          <h1>Referred bookings</h1>
          <p>Follow attributed stays and event referrals through fulfilment.</p>
        </div>
      </div>

      {/* Search + filter toolbar */}
      <form className="reach-discovery-toolbar" method="get">
        <input
          name="q"
          defaultValue={query?.q || ""}
          placeholder="Search by reference, property or campaign"
          aria-label="Search bookings"
        />
        <select name="status" defaultValue={query?.status || "ALL"} aria-label="Filter by status">
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>{s === "ALL" ? "All statuses" : s}</option>
          ))}
        </select>
        <button className="reach-button primary small">Filter</button>
        {(q || status) && (
          <Link href="/partner/bookings" className="reach-button secondary small">
            Clear
          </Link>
        )}
        <span>{total} total booking{total !== 1 ? "s" : ""}</span>
      </form>

      <div className="reach-table-card reach-card">
        <div className="reach-card-head">
          <div>
            <h2>Booking history</h2>
            <p>
              Page {page} of {pages} — only records attributed to your account.
            </p>
          </div>
          <Link href="/partner/analytics" className="reach-text-link">
            View analytics →
          </Link>
        </div>

        <div className="reach-table-wrap">
          <table className="reach-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Property</th>
                <th>Category</th>
                <th>Created</th>
                <th>Fulfilment</th>
                <th>Eligible revenue</th>
                <th>Commission</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <strong>#{booking.id.slice(0, 8).toUpperCase()}</strong>
                    <small>{booking.campaign?.name || "Direct referral link"}</small>
                  </td>
                  <td>
                    {booking.property.name}
                    <small>{booking.property.city}</small>
                  </td>
                  <td>{booking.category}</td>
                  <td>{booking.createdAt.toLocaleDateString("en-NG")}</td>
                  <td>
                    <span
                      className={`reach-pill ${
                        booking.status === "FULFILLED"
                          ? "success"
                          : booking.status === "CANCELLED" || booking.status === "REFUNDED"
                          ? "danger"
                          : "pending"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td>
                    {Number(booking.eligibleRevenue).toLocaleString("en-NG", {
                      style: "currency",
                      currency: booking.currency,
                    })}
                  </td>
                  <td>
                    {booking.commission ? (
                      <>
                        <span
                          className={`reach-pill ${
                            booking.commission.status === "PAID"
                              ? "success"
                              : booking.commission.status === "REVERSED"
                              ? "danger"
                              : "pending"
                          }`}
                        >
                          {booking.commission.status}
                        </span>
                        <small>
                          {Number(booking.commission.amount).toLocaleString("en-NG", {
                            style: "currency",
                            currency: booking.commission.currency,
                          })}
                        </small>
                      </>
                    ) : (
                      <span className="reach-pill pending">NOT ACCRUED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filtered.length && (
            <div className="reach-empty compact">
              <strong>{q || status ? "No bookings match those filters" : "No attributed bookings yet"}</strong>
              <p>
                {q || status
                  ? "Try a different search term or status."
                  : "Share an eligible property link to start building your referral performance."}
              </p>
            </div>
          )}
        </div>

        {pages > 1 && (
          <div className="reach-pagination">
            <span>{total} total bookings</span>
            <div>
              {page > 1 && (
                <Link
                  href={searchUrl({ page: String(page - 1) })}
                  className="reach-button secondary small"
                >
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link
                  href={searchUrl({ page: String(page + 1) })}
                  className="reach-button primary small"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </PartnerShell>
  );
}

import Link from "next/link";
import prisma from "@hotel-pms/db";
import { PartnerShell } from "@/components/partner-shell";
import { getPartnerProperties, getPartnerWalletBalance, requirePartnerPortal } from "@/lib/partner-portal";
import { PartnerAnalyticsCharts } from "./PartnerAnalyticsCharts";

function buildTimeline(since: Date, until: Date, clicks: Array<{ occurredAt: Date }>, bookings: Array<{ createdAt: Date }>) {
  const clickDays = new Map<string, number>();
  clicks.forEach((click) => { const key = click.occurredAt.toISOString().slice(0, 10); clickDays.set(key, (clickDays.get(key) || 0) + 1); });
  const bookingDays = new Map<string, number>();
  bookings.forEach((booking) => { const key = booking.createdAt.toISOString().slice(0, 10); bookingDays.set(key, (bookingDays.get(key) || 0) + 1); });
  const timeline: Array<{ date: string; clicks: number; bookings: number }> = [];
  const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  const end = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate()));
  for (let index = 0; cursor <= end && index < 366; index += 1) {
    const date = cursor.toISOString().slice(0, 10);
    timeline.push({ date, clicks: clickDays.get(date) || 0, bookings: bookingDays.get(date) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return timeline;
}

export default async function PartnerAnalyticsPage({ searchParams }: { searchParams?: Promise<{ days?: string; from?: string; to?: string }> }) {
  const partner = await requirePartnerPortal();
  const query = await searchParams;
  const days = [7, 30, 90].includes(Number(query?.days)) ? Number(query?.days) : 30;
  const customFrom = query?.from ? new Date(`${query.from}T00:00:00`) : null;
  const customTo = query?.to ? new Date(`${query.to}T23:59:59.999`) : null;
  const since = customFrom && !Number.isNaN(customFrom.getTime()) ? customFrom : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const until = customTo && !Number.isNaN(customTo.getTime()) ? customTo : new Date();
  const periodFilter = { gte: since, lte: until };
  const [{ propertyIds, scope }, wallet] = await Promise.all([getPartnerProperties(partner.id, partner.organizationId), getPartnerWalletBalance(partner.id)]);
  const [clicks, bookings, commissions] = await Promise.all([
    prisma.referralClick.findMany({ where: { ...scope, propertyId: { in: propertyIds }, occurredAt: periodFilter }, select: { occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 500 }),
    prisma.referralBooking.findMany({ where: { ...scope, propertyId: { in: propertyIds }, createdAt: periodFilter }, select: { status: true, category: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.referralCommission.groupBy({ by: ["status"], where: { ...scope, propertyId: { in: propertyIds }, createdAt: periodFilter }, _sum: { amount: true } }),
  ]);
  const fulfilled = bookings.filter((booking) => booking.status === "FULFILLED").length;
  const conversion = clicks.length ? (bookings.length / clicks.length) * 100 : 0;
  const timeline = buildTimeline(since, until, clicks, bookings);
  const fromValue = customFrom && !Number.isNaN(customFrom.getTime()) ? query?.from : "";
  const toValue = customTo && !Number.isNaN(customTo.getTime()) ? query?.to : "";

  return <PartnerShell partner={partner} availableBalance={Number(wallet?.availableBalance || 0)} currency={wallet?.currency || "NGN"}>
    <div className="reach-page-head"><div><span className="reach-eyebrow">Performance</span><h1>Analytics</h1><p>Real Reach activity for the selected period.</p></div><div className="reach-head-actions">{[7, 30, 90].map((period) => <Link key={period} href={`/partner/analytics?days=${period}`} className={`reach-button ${days === period && !fromValue ? "primary" : "secondary"} small`}>{period} days</Link>)}</div></div>
    <form className="reach-discovery-toolbar" method="get"><span>Custom period</span><input type="date" name="from" defaultValue={fromValue} aria-label="Analytics start date" required /><input type="date" name="to" defaultValue={toValue} aria-label="Analytics end date" required /><button className="reach-button primary small">Apply range</button></form>
    <div className="reach-kpi-grid"><div className="reach-kpi"><div className="reach-kpi-icon blue">↗</div><div><p>Tracked clicks</p><strong>{clicks.length}</strong><small>Selected period</small></div></div><div className="reach-kpi"><div className="reach-kpi-icon violet">▣</div><div><p>Attributed bookings</p><strong>{bookings.length}</strong><small>{fulfilled} fulfilled</small></div></div><div className="reach-kpi"><div className="reach-kpi-icon green">%</div><div><p>Conversion rate</p><strong>{conversion.toFixed(1)}%</strong><small>Bookings ÷ clicks</small></div></div><div className="reach-kpi"><div className="reach-kpi-icon amber">₦</div><div><p>Commission value</p><strong>₦{commissions.reduce((sum, row) => sum + Number(row._sum.amount || 0), 0).toLocaleString("en-NG")}</strong><small>Recorded in period</small></div></div></div>
    <PartnerAnalyticsCharts data={timeline} />
    <div className="reach-dashboard-grid"><div className="reach-card"><div className="reach-card-head"><div><h2>Booking mix</h2><p>Attributed categories and fulfilment states.</p></div></div><div className="reach-rule-grid"><div><strong>{bookings.filter((booking) => booking.category === "STAY").length}</strong><span>Room stays</span></div><div><strong>{bookings.filter((booking) => booking.category !== "STAY").length}</strong><span>Events / venues</span></div><div><strong>{fulfilled}</strong><span>Completed</span></div></div></div><div className="reach-card"><div className="reach-card-head"><div><h2>Commission status</h2><p>Value by current lifecycle state.</p></div></div><div className="reach-performance-bars">{commissions.map((row) => <div key={row.status}><span><b>{row.status}</b><em>₦{Number(row._sum.amount || 0).toLocaleString("en-NG")}</em></span><div className="reach-progress"><i style={{ width: `${Number(row._sum.amount || 0) ? 100 : 0}%` }} /></div></div>)}{!commissions.length && <div className="reach-empty compact"><strong>No commission activity yet</strong></div>}</div></div></div>
  </PartnerShell>;
}

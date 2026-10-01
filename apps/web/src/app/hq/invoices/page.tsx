import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { InvoiceControlCenter } from './InvoiceControlCenter';

const DAY = 24 * 60 * 60 * 1000;

export default async function HQInvoicesPage() {
  await requireHQAdmin();
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const invoices = await prisma.billingInvoice.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { id: true, organizationId: true, flutterwaveInvoiceId: true, flutterwaveSubscriptionId: true, status: true, currency: true, subtotal: true, total: true, amountPaid: true, amountDue: true, periodStart: true, periodEnd: true, hostedInvoiceUrl: true, invoicePdf: true, createdAt: true, updatedAt: true, organization: { select: { name: true, slug: true, defaultCurrency: true, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, plan: { select: { name: true } } } } } } },
  });

  const currencyTotals = new Map<string, { billed: number; collected: number; due: number }>();
  const statusCounts = new Map<string, number>();
  const aging = { current: 0, oneToThirty: 0, thirtyOneToSixty: 0, sixtyOneToNinety: 0, ninetyPlus: 0 };
  const monthly = Array.from({ length: 6 }, (_, index) => { const date = new Date(since); date.setMonth(since.getMonth() + index); return { label: date.toLocaleDateString('en-US', { month: 'short' }), billed: 0, collected: 0, invoices: 0 }; });
  const organizationTotals = new Map<string, { name: string; slug: string; currency: string; billed: number; collected: number; due: number; invoices: number; failed: number; latestStatus: string }>();
  for (const invoice of invoices) {
    const currency = invoice.currency.toUpperCase();
    const totals = currencyTotals.get(currency) ?? { billed: 0, collected: 0, due: 0 };
    totals.billed += invoice.total; totals.collected += invoice.amountPaid; totals.due += invoice.amountDue; currencyTotals.set(currency, totals);
    const status = invoice.status.toUpperCase(); statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    const referenceDate = invoice.periodEnd ?? invoice.createdAt;
    const age = invoice.amountDue > 0 ? Math.max(0, Math.floor((now.getTime() - referenceDate.getTime()) / DAY)) : 0;
    if (invoice.amountDue > 0) { if (age === 0) aging.current += invoice.amountDue; else if (age <= 30) aging.oneToThirty += invoice.amountDue; else if (age <= 60) aging.thirtyOneToSixty += invoice.amountDue; else if (age <= 90) aging.sixtyOneToNinety += invoice.amountDue; else aging.ninetyPlus += invoice.amountDue; }
    const point = monthly.find((item, index) => { const date = new Date(since); date.setMonth(since.getMonth() + index); return date.getFullYear() === invoice.createdAt.getFullYear() && date.getMonth() === invoice.createdAt.getMonth(); });
    if (point) { point.billed += invoice.total; point.collected += invoice.amountPaid; point.invoices += 1; }
    const org = organizationTotals.get(invoice.organizationId) ?? { name: invoice.organization.name, slug: invoice.organization.slug, currency, billed: 0, collected: 0, due: 0, invoices: 0, failed: 0, latestStatus: status };
    org.billed += invoice.total; org.collected += invoice.amountPaid; org.due += invoice.amountDue; org.invoices += 1; if (['FAILED', 'UNCOLLECTIBLE', 'PAST_DUE'].includes(status)) org.failed += 1; if (org.latestStatus === 'PAID' && status !== 'PAID') org.latestStatus = status; organizationTotals.set(invoice.organizationId, org);
  }

  const rows = invoices.map((invoice) => ({ id: invoice.id, organizationId: invoice.organizationId, organizationName: invoice.organization.name, organizationSlug: invoice.organization.slug, currency: invoice.currency.toUpperCase(), invoiceId: invoice.flutterwaveInvoiceId, subscriptionId: invoice.flutterwaveSubscriptionId, status: invoice.status.toUpperCase(), subtotal: invoice.subtotal, total: invoice.total, amountPaid: invoice.amountPaid, amountDue: invoice.amountDue, periodStart: invoice.periodStart?.toISOString() ?? null, periodEnd: invoice.periodEnd?.toISOString() ?? null, hostedInvoiceUrl: invoice.hostedInvoiceUrl, invoicePdf: invoice.invoicePdf, createdAt: invoice.createdAt.toISOString(), updatedAt: invoice.updatedAt.toISOString(), plan: invoice.organization.subscriptions[0]?.plan?.name ?? 'Unconfigured', subscriptionStatus: invoice.organization.subscriptions[0]?.status ?? 'NO PLAN' }));
  const statusMix = [...statusCounts.entries()].map(([status, count]) => ({ status, count }));
  const exposure = [...organizationTotals.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.due - a.due);
  const formattedTotals = [...currencyTotals.entries()].map(([currency, value]) => ({ currency, ...value }));
  return <InvoiceControlCenter data={{ generatedAt: now.toISOString(), invoices: rows, monthly, statusMix, aging, exposure, currencyTotals: formattedTotals, metrics: { invoiceCount: invoices.length, paid: invoices.filter((invoice) => invoice.status.toLowerCase() === 'paid').length, failed: invoices.filter((invoice) => ['failed', 'uncollectible'].includes(invoice.status.toLowerCase())).length, pastDue: invoices.filter((invoice) => invoice.amountDue > 0 && (invoice.periodEnd ?? invoice.createdAt) < now).length, collectionRate: invoices.reduce((sum, invoice) => sum + invoice.total, 0) ? Math.round((invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0) / invoices.reduce((sum, invoice) => sum + invoice.total, 0)) * 100) : 0, agingTotal: Object.values(aging).reduce((sum, amount) => sum + amount, 0) } }} />;
}

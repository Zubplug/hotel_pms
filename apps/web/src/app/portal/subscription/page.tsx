import { redirect } from 'next/navigation';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import SubscriptionPortal from './SubscriptionPortal';

const activeStatuses = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

function number(value: unknown) {
  return typeof value === 'bigint' ? Number(value) : Number(value || 0);
}

export default async function SubscriptionPortalPage() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!session?.user || !organizationId) redirect('/login');

  const now = new Date();
  const chartStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, defaultCurrency: true, defaultTimezone: true },
  });
  if (!organization) redirect('/login');

  const [properties, subscriptions, entitlements, invoices, plans, staffCount, outletsCount, monthlyInvoices, recentActivity] = await Promise.all([
    prisma.property.findMany({ where: { organizationId }, select: { id: true, name: true, city: true, country: true, baseCurrency: true, businessDate: true, isActive: true, suspendedAt: true, suspensionReason: true, auditStatus: true }, orderBy: { name: 'asc' } }),
    prisma.subscription.findMany({ where: { organizationId }, orderBy: { updatedAt: 'desc' }, include: { plan: { include: { items: { include: { product: true } } } }, items: { include: { price: { include: { product: true } } } } } }),
    prisma.entitlement.findMany({ where: { organizationId }, orderBy: [{ propertyId: 'asc' }, { productCode: 'asc' }], include: { product: true, property: { select: { name: true } } } }),
    prisma.billingInvoice.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 12 }),
    prisma.billingPlan.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' }, include: { items: { include: { product: { include: { prices: { orderBy: { amount: 'asc' } } } } } } } }),
    prisma.staff.count({ where: { organizationId, isActive: true } }),
    prisma.posOutlet.count({ where: { property: { organizationId }, isActive: true } }),
    prisma.billingInvoice.findMany({ where: { organizationId, createdAt: { gte: chartStart } }, select: { createdAt: true, total: true, amountPaid: true, currency: true } }),
    prisma.billingEvent.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, type: true, createdAt: true } }),
  ]);

  const current = subscriptions.find((item) => activeStatuses.includes(item.status));
  const primaryCurrency = current?.items[0]?.price.currency || organization.defaultCurrency;
  const propertyIds = properties.map((item) => item.id);
  const propertyMetrics = properties.map((property) => ({ id: property.id, name: property.name, city: property.city, country: property.country, currency: property.baseCurrency, isActive: property.isActive, suspendedAt: property.suspendedAt?.toISOString() || null, suspensionReason: property.suspensionReason, auditStatus: property.auditStatus }));

  const months = Array.from({ length: 6 }, (_, index) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1)));
  const revenueTrend = months.map((month) => {
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const rows = monthlyInvoices.filter((invoice) => invoice.createdAt >= month && invoice.createdAt < next);
    return { label: month.toLocaleDateString('en-US', { month: 'short' }), billed: rows.reduce((sum, row) => sum + row.total, 0) / 100, collected: rows.reduce((sum, row) => sum + row.amountPaid, 0) / 100 };
  });

  return <SubscriptionPortal data={{
    organization: { ...organization, propertyCount: propertyIds.length },
    current: current ? { ...current, createdAt: current.createdAt.toISOString(), updatedAt: current.updatedAt.toISOString(), currentPeriodStart: current.currentPeriodStart.toISOString(), currentPeriodEnd: current.currentPeriodEnd.toISOString(), trialEndsAt: current.trialEndsAt?.toISOString() || null, canceledAt: current.canceledAt?.toISOString() || null } : null,
    properties: propertyMetrics,
    plans: plans.map((plan) => ({ ...plan, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(), items: plan.items.map((item) => ({ ...item, product: { ...item.product, createdAt: item.product.createdAt.toISOString(), updatedAt: item.product.updatedAt.toISOString(), prices: item.product.prices.map((price) => ({ ...price, createdAt: price.createdAt.toISOString(), updatedAt: price.updatedAt.toISOString() })) } })) })),
    entitlements: entitlements.map((item) => ({ ...item, startsAt: item.startsAt.toISOString(), activatedAt: item.activatedAt.toISOString(), expiresAt: item.expiresAt?.toISOString() || null, suspendedAt: item.suspendedAt?.toISOString() || null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    invoices: invoices.map((invoice) => ({ ...invoice, createdAt: invoice.createdAt.toISOString(), updatedAt: invoice.updatedAt.toISOString(), periodStart: invoice.periodStart?.toISOString() || null, periodEnd: invoice.periodEnd?.toISOString() || null })),
    metrics: { staffCount, outletsCount, currency: primaryCurrency },
    revenueTrend,
    activity: recentActivity.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    generatedAt: now.toISOString(),
  }} />;
}

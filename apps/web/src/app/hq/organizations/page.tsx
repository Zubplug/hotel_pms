import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { OrganizationsPortfolio } from './OrganizationsPortfolio';

const DAY = 24 * 60 * 60 * 1000;

export default async function HQOrganizationsPage() {
  await requireHQAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const growthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [organizations, invoices, channels] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, slug: true, defaultCurrency: true, defaultTimezone: true, createdAt: true,
        properties: { select: { id: true, name: true, city: true, country: true, isActive: true, businessDate: true, auditStatus: true, createdAt: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, plan: { select: { name: true } }, currentPeriodEnd: true } },
        entitlements: { where: { status: 'ACTIVE' }, select: { productCode: true } },
        memberships: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    }),
    prisma.billingInvoice.findMany({ where: { createdAt: { gte: monthStart } }, select: { organizationId: true, status: true, amountDue: true, amountPaid: true } }),
    prisma.channelConnection.findMany({ select: { organizationId: true, status: true, lastSuccessfulSync: true } }),
  ]);

  const invoiceByOrg = new Map<string, { due: number; paid: number; attention: boolean }>();
  invoices.forEach((invoice) => {
    const current = invoiceByOrg.get(invoice.organizationId) ?? { due: 0, paid: 0, attention: false };
    current.due += invoice.amountDue;
    current.paid += invoice.amountPaid;
    if (['failed', 'uncollectible', 'past_due', 'open'].includes(invoice.status.toLowerCase()) && invoice.amountDue > 0) current.attention = true;
    invoiceByOrg.set(invoice.organizationId, current);
  });
  const channelByOrg = new Map<string, { total: number; issues: number; stale: number }>();
  channels.forEach((channel) => {
    const current = channelByOrg.get(channel.organizationId) ?? { total: 0, issues: 0, stale: 0 };
    current.total += 1;
    if (['ERROR', 'DEGRADED', 'DISCONNECTED'].includes(channel.status)) current.issues += 1;
    if (!channel.lastSuccessfulSync || now.getTime() - channel.lastSuccessfulSync.getTime() > DAY) current.stale += 1;
    channelByOrg.set(channel.organizationId, current);
  });

  const propertyRows = organizations.flatMap((org) => org.properties.map((property) => ({
    id: property.id, organizationId: org.id, organizationName: org.name, name: property.name, city: property.city, country: property.country,
    isActive: property.isActive, businessDate: property.businessDate?.toISOString() ?? null, auditStatus: property.auditStatus, createdAt: property.createdAt.toISOString(),
    lifecycle: !property.isActive ? 'Suspended' : property.businessDate && property.auditStatus ? 'Operational' : 'Setup in progress',
  })));

  const organizationRows = organizations.map((org) => {
    const properties = propertyRows.filter((property) => property.organizationId === org.id);
    const subscription = org.subscriptions[0];
    const invoice = invoiceByOrg.get(org.id) ?? { due: 0, paid: 0, attention: false };
    const channel = channelByOrg.get(org.id) ?? { total: 0, issues: 0, stale: 0 };
    const readiness = properties.length > 0 && properties.every((property) => property.lifecycle === 'Operational');
    const billingAttention = !subscription || ['PAST_DUE', 'PAUSED', 'INCOMPLETE', 'CANCELED'].includes(subscription.status) || invoice.attention;
    const state = !properties.length ? 'No properties' : billingAttention ? 'Billing attention' : !readiness ? 'Setup in progress' : channel.issues ? 'Integration attention' : 'Operational';
    return { id: org.id, name: org.name, slug: org.slug, currency: org.defaultCurrency, timezone: org.defaultTimezone, createdAt: org.createdAt.toISOString(), properties: properties.length, activeProperties: properties.filter((property) => property.isActive).length, activeUsers: org.memberships.length, plan: subscription?.plan?.name ?? 'Unconfigured', subscriptionStatus: subscription?.status ?? 'NO PLAN', periodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null, entitlements: org.entitlements.map((item) => item.productCode), channelTotal: channel.total, channelIssues: channel.issues, staleChannels: channel.stale, invoiceDue: invoice.due, invoicePaid: invoice.paid, readiness, billingAttention, state, propertyRows: properties };
  });

  const growth = Array.from({ length: 6 }, (_, index) => { const date = new Date(growthStart); date.setMonth(growthStart.getMonth() + index); return { label: date.toLocaleDateString('en-US', { month: 'short' }), organizations: organizations.filter((org) => org.createdAt.getFullYear() === date.getFullYear() && org.createdAt.getMonth() === date.getMonth()).length, properties: propertyRows.filter((property) => new Date(property.createdAt).getFullYear() === date.getFullYear() && new Date(property.createdAt).getMonth() === date.getMonth()).length }; });
  return <OrganizationsPortfolio data={{ generatedAt: now.toISOString(), monthStart: monthStart.toISOString(), organizations: organizationRows, properties: propertyRows, growth, totalInvoicesDue: invoices.reduce((sum, invoice) => sum + invoice.amountDue, 0), channelIssues: channels.filter((channel) => ['ERROR', 'DEGRADED', 'DISCONNECTED'].includes(channel.status)).length, staleChannels: channels.filter((channel) => !channel.lastSuccessfulSync || now.getTime() - channel.lastSuccessfulSync.getTime() > DAY).length }} />;
}

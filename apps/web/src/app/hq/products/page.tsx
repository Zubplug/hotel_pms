import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import ProductsWorkspace from './ProductsWorkspace';

const money = (value: unknown) => Number(value || 0);
const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const iso = (date: Date) => date.toISOString();

export default async function HQProductsPage() {
  await requireHQAdmin();

  const now = new Date();
  const today = day(now);
  const trendStart = new Date(today);
  trendStart.setDate(trendStart.getDate() - 13);
  const trendEnd = new Date(today);
  trendEnd.setDate(trendEnd.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [products, plans, subscriptions, invoices, organizations, recentInvoices, properties, rooms, reservations, payments, housekeeping, maintenance, inventoryAlerts, channels, integrations] = await Promise.all([
    prisma.billingProduct.findMany({ include: { prices: { orderBy: { amount: 'asc' } }, _count: { select: { entitlements: true, planItems: true, modules: true } } }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] }),
    prisma.billingPlan.findMany({ include: { items: true }, orderBy: { displayOrder: 'asc' } }),
    prisma.subscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'PAUSED'] } }, include: { items: { include: { price: { include: { product: { select: { id: true } } } } } } } }),
    prisma.billingInvoice.findMany({ where: { createdAt: { gte: monthStart } }, select: { total: true, amountPaid: true, amountDue: true, status: true, currency: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.organization.findMany({ select: { id: true, name: true, createdAt: true, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } } }),
    prisma.billingInvoice.findMany({ take: 6, orderBy: { createdAt: 'desc' }, select: { id: true, total: true, amountDue: true, status: true, currency: true, createdAt: true, organization: { select: { name: true } } } }),
    prisma.property.findMany({ where: { deletedAt: null }, select: { id: true, name: true, city: true, country: true, isActive: true, businessDate: true, auditStatus: true, _count: { select: { rooms: true, reservations: true, guests: true, housekeepingTasks: true, maintenanceTickets: true } } }, orderBy: { name: 'asc' } }),
    prisma.room.findMany({ where: { deletedAt: null, isActive: true }, select: { id: true, status: true, housekeepingStatus: true, propertyId: true } }),
    prisma.reservation.findMany({ where: { checkOut: { gte: trendStart }, checkIn: { lt: trendEnd }, status: { notIn: ['CANCELLED', 'NO_SHOW', 'EXPIRED'] } }, select: { checkIn: true, checkOut: true, status: true, propertyId: true } }),
    prisma.payment.findMany({ where: { businessDate: { gte: trendStart, lt: trendEnd }, status: 'COMPLETED' }, select: { amount: true, businessDate: true, currency: true } }),
    prisma.housekeepingTask.findMany({ where: { businessDate: today }, select: { status: true } }),
    prisma.maintenanceTicket.findMany({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'] } }, select: { priority: true, status: true } }),
    prisma.inventoryAlert.count({ where: { status: 'OPEN' } }),
    prisma.channelConnection.findMany({ select: { provider: true, status: true, lastSuccessfulSync: true, property: { select: { name: true } } } }),
    prisma.installedIntegration.findMany({ select: { status: true } }),
  ]);

  const activeSubscriptions = subscriptions.filter((subscription) => ['ACTIVE', 'TRIALING'].includes(subscription.status));
  const productUsage = new Map<string, { accounts: Set<string>; quantity: number; mrr: number }>();
  for (const subscription of subscriptions) for (const item of subscription.items) {
    const product = item.price.product;
    const current = productUsage.get(product.id) ?? { accounts: new Set<string>(), quantity: 0, mrr: 0 };
    if (['ACTIVE', 'TRIALING'].includes(subscription.status)) current.accounts.add(subscription.organizationId);
    current.quantity += item.quantity;
    current.mrr += item.price.interval === 'year' ? Math.round((item.price.amount * item.quantity) / 12) : item.price.amount * item.quantity;
    productUsage.set(product.id, current);
  }

  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => { const date = new Date(monthStart); date.setMonth(monthStart.getMonth() + index); return { label: date.toLocaleDateString('en-US', { month: 'short' }), revenue: 0, invoices: 0 }; });
  for (const invoice of invoices) { const point = monthlyRevenue.find((item, index) => { const date = new Date(monthStart); date.setMonth(monthStart.getMonth() + index); return date.getFullYear() === invoice.createdAt.getFullYear() && date.getMonth() === invoice.createdAt.getMonth(); }); if (point) { point.revenue += invoice.amountPaid; point.invoices += 1; } }

  const totalRooms = rooms.length;
  const liveRooms = rooms.filter((room) => room.status === 'OCCUPIED').length;
  const availableRooms = rooms.filter((room) => room.status === 'AVAILABLE').length;
  const todayReservations = reservations.filter((reservation) => day(reservation.checkIn).getTime() === today.getTime());
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(trendStart); date.setDate(trendStart.getDate() + index);
    const occupiedNights = reservations.filter((reservation) => day(reservation.checkIn) <= date && day(reservation.checkOut) > date).length;
    const revenue = payments.filter((payment) => day(payment.businessDate).getTime() === date.getTime()).reduce((sum, payment) => sum + money(payment.amount), 0);
    return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), occupancy: totalRooms ? Math.round((occupiedNights / totalRooms) * 100) : 0, revenue };
  });
  const collected = invoices.reduce((total, invoice) => total + invoice.amountPaid, 0);
  const outstanding = invoices.reduce((total, invoice) => total + invoice.amountDue, 0);
  const totalMrr = activeSubscriptions.reduce((total, subscription) => total + subscription.items.reduce((subtotal, item) => subtotal + (item.price.interval === 'year' ? Math.round((item.price.amount * item.quantity) / 12) : item.price.amount * item.quantity), 0), 0);

  return <ProductsWorkspace data={{
    generatedAt: iso(now),
    catalog: products.map((product) => ({ id: product.id, name: product.name, code: product.code, type: product.type, active: product.active, flutterwaveProductId: product.flutterwaveProductId, createdAt: product.createdAt.toISOString(), prices: product.prices.map((price) => ({ id: price.id, amount: price.amount, currency: price.currency, interval: price.interval, flutterwavePriceId: price.flutterwavePriceId })), adoption: productUsage.get(product.id)?.accounts.size ?? 0, mrr: productUsage.get(product.id)?.mrr ?? 0, planCount: product._count.planItems, entitlementCount: product._count.entitlements, moduleCount: product._count.modules })),
    plans: plans.map((plan) => ({ id: plan.id, name: plan.name, code: plan.code, active: plan.active, itemCount: plan.items.length })),
    monthlyRevenue,
    trend,
    recentInvoices: recentInvoices.map((invoice) => ({ ...invoice, createdAt: invoice.createdAt.toISOString(), organizationName: invoice.organization.name })),
    properties: properties.map((property) => ({ id: property.id, name: property.name, city: property.city, country: property.country, isActive: property.isActive, businessDate: property.businessDate?.toISOString() ?? null, auditStatus: property.auditStatus, rooms: property._count.rooms, reservations: property._count.reservations, guests: property._count.guests, housekeeping: property._count.housekeepingTasks, maintenance: property._count.maintenanceTickets })),
    metrics: { totalProducts: products.length, activeProducts: products.filter((product) => product.active).length, totalPlans: plans.length, activeSubscriptions: activeSubscriptions.length, totalOrganizations: organizations.length, totalMrr, collected, outstanding, failedInvoices: invoices.filter((invoice) => ['failed', 'uncollectible', 'past_due'].includes(invoice.status.toLowerCase())).length, totalProperties: properties.length, activeProperties: properties.filter((property) => property.isActive).length, totalRooms, occupiedRooms: liveRooms, availableRooms, arrivalCount: todayReservations.length, departures: reservations.filter((reservation) => day(reservation.checkOut).getTime() === today.getTime()).length, housekeepingOpen: housekeeping.filter((task) => !['CLEAN', 'INSPECTED'].includes(task.status)).length, maintenanceOpen: maintenance.length, criticalMaintenance: maintenance.filter((ticket) => ticket.priority === 'CRITICAL').length, inventoryAlerts, channelErrors: channels.filter((channel) => ['ERROR', 'DEGRADED', 'DISCONNECTED'].includes(channel.status)).length, connectedChannels: channels.filter((channel) => channel.status === 'CONNECTED').length, integrationIssues: integrations.filter((integration) => !['ACTIVE', 'CONNECTED', 'COMPLETED'].includes(integration.status)).length },
  }} />;
}

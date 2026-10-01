import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { OrganizationsPortfolio } from './OrganizationsPortfolio';

const DAY = 24 * 60 * 60 * 1000;

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function HQOrganizationsPage() {
  await requireHQAdmin();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodStart = new Date(today.getTime() - 29 * DAY);
  const periodEnd = new Date(today.getTime() + 31 * DAY);

  const [organizations, rooms, reservations, folioItems, housekeepingTasks, maintenanceTickets, channels] = await Promise.all([
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
    prisma.room.findMany({ where: { isActive: true, deletedAt: null }, select: { propertyId: true, status: true, housekeepingStatus: true, maintenanceStatus: true } }),
    prisma.reservation.findMany({
      where: { deletedAt: null, checkIn: { lte: periodEnd }, checkOut: { gte: periodStart } },
      select: { propertyId: true, status: true, checkIn: true, checkOut: true, createdAt: true },
    }),
    prisma.folioItem.findMany({
      where: { businessDate: { gte: periodStart, lte: today }, type: 'CHARGE', voidedAt: null },
      select: { propertyId: true, businessDate: true, amount: true, currency: true, revenueCategory: true },
    }),
    prisma.housekeepingTask.findMany({ where: { businessDate: { gte: periodStart, lte: today }, status: { notIn: ['CANCELLED', 'INSPECTED'] } }, select: { propertyId: true, status: true } }),
    prisma.maintenanceTicket.findMany({ where: { status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } }, select: { propertyId: true, status: true, priority: true } }),
    prisma.channelConnection.findMany({ select: { organizationId: true, propertyId: true, provider: true, status: true, lastSuccessfulSync: true } }),
  ]);

  const propertyToOrg = new Map(organizations.flatMap((org) => org.properties.map((property) => [property.id, org.id] as const)));
  const roomByProperty = new Map<string, { total: number; occupied: number; unavailable: number; dirty: number; maintenance: number }>();
  for (const room of rooms) {
    const current = roomByProperty.get(room.propertyId) ?? { total: 0, occupied: 0, unavailable: 0, dirty: 0, maintenance: 0 };
    current.total += 1;
    if (room.status === 'OCCUPIED') current.occupied += 1;
    if (['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'BLOCKED'].includes(room.status)) current.unavailable += 1;
    if (['DIRTY', 'CLEANING'].includes(room.housekeepingStatus)) current.dirty += 1;
    if (['MAINTENANCE', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'].includes(room.status) || room.maintenanceStatus !== 'NONE') current.maintenance += 1;
    roomByProperty.set(room.propertyId, current);
  }

  const revenueByProperty = new Map<string, { total: number; room: number }>();
  const revenueDaily = new Map<string, number>();
  for (const item of folioItems) {
    const current = revenueByProperty.get(item.propertyId) ?? { total: 0, room: 0 };
    const amount = Number(item.amount);
    current.total += amount;
    if (item.revenueCategory === 'ROOM') current.room += amount;
    revenueByProperty.set(item.propertyId, current);
    const key = dayKey(item.businessDate);
    revenueDaily.set(key, (revenueDaily.get(key) ?? 0) + amount);
  }

  const reservationByProperty = new Map<string, { active: number; arrivals: number; departures: number }>();
  for (const reservation of reservations) {
    const current = reservationByProperty.get(reservation.propertyId) ?? { active: 0, arrivals: 0, departures: 0 };
    if (['CONFIRMED', 'CHECKED_IN'].includes(reservation.status) && reservation.checkIn <= today && reservation.checkOut > today) current.active += 1;
    if (reservation.checkIn.toISOString().slice(0, 10) === dayKey(today) && !['CANCELLED', 'NO_SHOW'].includes(reservation.status)) current.arrivals += 1;
    if (reservation.checkOut.toISOString().slice(0, 10) === dayKey(today) && !['CANCELLED', 'NO_SHOW'].includes(reservation.status)) current.departures += 1;
    reservationByProperty.set(reservation.propertyId, current);
  }

  const taskByProperty = new Map<string, number>();
  housekeepingTasks.forEach((task) => taskByProperty.set(task.propertyId, (taskByProperty.get(task.propertyId) ?? 0) + 1));
  const maintenanceByProperty = new Map<string, { open: number; critical: number }>();
  maintenanceTickets.forEach((ticket) => {
    const current = maintenanceByProperty.get(ticket.propertyId) ?? { open: 0, critical: 0 };
    current.open += 1;
    if (ticket.priority === 'CRITICAL') current.critical += 1;
    maintenanceByProperty.set(ticket.propertyId, current);
  });
  const channelsByOrg = new Map<string, { total: number; issues: number }>();
  channels.forEach((channel) => {
    const current = channelsByOrg.get(channel.organizationId) ?? { total: 0, issues: 0 };
    current.total += 1;
    if (['ERROR', 'DEGRADED', 'DISCONNECTED'].includes(channel.status)) current.issues += 1;
    channelsByOrg.set(channel.organizationId, current);
  });

  const propertyRows = organizations.flatMap((org) => org.properties.map((property) => {
    const room = roomByProperty.get(property.id) ?? { total: 0, occupied: 0, unavailable: 0, dirty: 0, maintenance: 0 };
    const reservation = reservationByProperty.get(property.id) ?? { active: 0, arrivals: 0, departures: 0 };
    const revenue = revenueByProperty.get(property.id) ?? { total: 0, room: 0 };
    const sellable = Math.max(0, room.total - room.unavailable);
    return { id: property.id, organizationId: org.id, organizationName: org.name, name: property.name, city: property.city, country: property.country, isActive: property.isActive, businessDate: property.businessDate?.toISOString() ?? null, auditStatus: property.auditStatus, rooms: room.total, occupied: room.occupied, sellable, occupancy: sellable ? Math.round((room.occupied / sellable) * 100) : 0, dirty: room.dirty, maintenance: room.maintenance, activeReservations: reservation.active, arrivals: reservation.arrivals, departures: reservation.departures, openHousekeeping: taskByProperty.get(property.id) ?? 0, openMaintenance: maintenanceByProperty.get(property.id)?.open ?? 0, criticalMaintenance: maintenanceByProperty.get(property.id)?.critical ?? 0, revenue30d: revenue.total, roomRevenue30d: revenue.room, currency: org.defaultCurrency, createdAt: property.createdAt.toISOString() };
  }));

  const organizationRows = organizations.map((org) => {
    const properties = propertyRows.filter((property) => property.organizationId === org.id);
    const roomsTotal = properties.reduce((sum, property) => sum + property.rooms, 0);
    const sellable = properties.reduce((sum, property) => sum + property.sellable, 0);
    const occupied = properties.reduce((sum, property) => sum + property.occupied, 0);
    const roomRevenue = properties.reduce((sum, property) => sum + property.roomRevenue30d, 0);
    const revenue = properties.reduce((sum, property) => sum + property.revenue30d, 0);
    const subscription = org.subscriptions[0];
    const readiness = properties.length > 0 && properties.every((property) => property.isActive && property.businessDate && property.auditStatus);
    const billingAttention = !subscription || ['PAST_DUE', 'PAUSED', 'INCOMPLETE', 'CANCELED'].includes(subscription.status);
    const channel = channelsByOrg.get(org.id) ?? { total: 0, issues: 0 };
    return { id: org.id, name: org.name, slug: org.slug, currency: org.defaultCurrency, timezone: org.defaultTimezone, createdAt: org.createdAt.toISOString(), properties: properties.length, activeProperties: properties.filter((property) => property.isActive).length, rooms: roomsTotal, occupied, sellable, occupancy: sellable ? Math.round((occupied / sellable) * 100) : 0, roomRevenue30d: roomRevenue, revenue30d: revenue, activeReservations: properties.reduce((sum, property) => sum + property.activeReservations, 0), arrivals: properties.reduce((sum, property) => sum + property.arrivals, 0), departures: properties.reduce((sum, property) => sum + property.departures, 0), openHousekeeping: properties.reduce((sum, property) => sum + property.openHousekeeping, 0), openMaintenance: properties.reduce((sum, property) => sum + property.openMaintenance, 0), criticalMaintenance: properties.reduce((sum, property) => sum + property.criticalMaintenance, 0), channelTotal: channel.total, channelIssues: channel.issues, plan: subscription?.plan?.name ?? 'Unconfigured', subscriptionStatus: subscription?.status ?? 'NO PLAN', periodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null, entitlements: org.entitlements.map((item) => item.productCode), members: org.memberships.length, readiness, billingAttention, state: !properties.length ? 'No properties' : billingAttention ? 'Billing attention' : !readiness ? 'Setup in progress' : channel.issues ? 'Integration attention' : 'Operational', propertyRows: properties };
  });

  const portfolioCurrency = new Set(organizations.map((org) => org.defaultCurrency)).size === 1 ? organizations[0]?.defaultCurrency ?? 'NGN' : null;
  const daily = Array.from({ length: 14 }, (_, index) => { const date = new Date(today.getTime() - (13 - index) * DAY); const key = dayKey(date); const available = propertyRows.reduce((sum, property) => sum + property.sellable, 0); const occupiedOnDate = reservations.filter((reservation) => ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status) && reservation.checkIn <= date && reservation.checkOut > date).length; return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), occupancy: available ? Math.round((occupiedOnDate / available) * 100) : 0, revenue: revenueDaily.get(key) ?? 0 }; });

  return <OrganizationsPortfolio data={{ generatedAt: now.toISOString(), periodStart: periodStart.toISOString(), today: today.toISOString(), portfolioCurrency, organizations: organizationRows, properties: propertyRows, daily, channelIssues: channels.filter((channel) => ['ERROR', 'DEGRADED', 'DISCONNECTED'].includes(channel.status)).length, staleChannels: channels.filter((channel) => !channel.lastSuccessfulSync || now.getTime() - channel.lastSuccessfulSync.getTime() > 24 * 60 * 60 * 1000).length }} />;
}

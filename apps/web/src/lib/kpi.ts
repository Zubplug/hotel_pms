import { prisma } from '@hotel-pms/db';
import { startOfDay, endOfDay, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export type RevenueSnapshot = {
  totalRevenue: number;
  roomRevenue: number;
  fbRevenue: number;
  barRevenue: number;
  otherRevenue: number;
};

export type KPISnapshot = {
  occupancyPercent: number;
  adr: number;
  revpar: number;
  availableRooms: number;
  occupiedRooms: number;
  revenue: RevenueSnapshot;
};

/**
 * Authoritative function to get the current business date of a property.
 * If the property does not have a manually rolled businessDate, it falls back
 * to the current date in the property's configured timezone.
 */
export async function getPropertyBusinessDate(propertyId: string): Promise<Date> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { businessDate: true, timezone: true }
  });

  if (!property) throw new Error(`Property ${propertyId} not found`);

  if (property.businessDate) {
    return property.businessDate;
  }

  // Fallback: Use the current date in the property's timezone
  const now = new Date();
  const zonedTime = toZonedTime(now, property.timezone);
  // We want the Date object representing midnight of that zoned day in UTC
  const dateString = format(zonedTime, 'yyyy-MM-dd');
  return new Date(`${dateString}T00:00:00Z`);
}

/**
 * Authoritative Revenue Calculation for a given business date.
 * Separates Room Revenue, F&B (POS, Restaurant, Bar), and Other.
 */
export async function calculateDailyRevenue(propertyId: string, businessDate: Date): Promise<RevenueSnapshot> {
  const folioItems = await prisma.folioItem.findMany({
    where: {
      folio: { propertyId },
      businessDate: {
        gte: startOfDay(businessDate),
        lte: endOfDay(businessDate),
      },
      type: { in: ['CHARGE', 'DISCOUNT'] },
      voidedAt: null,
    },
    select: {
      amount: true,
      type: true,
      source: true,
    }
  });

  let roomRevenue = 0;
  let fbRevenue = 0;
  let barRevenue = 0;
  let otherRevenue = 0;

  for (const item of folioItems) {
    const amt = Number(item.amount);
    const sign = item.type === 'CHARGE' ? 1 : -1;
    const value = amt * sign;

    if (item.source === 'ROOM_CHARGE') {
      roomRevenue += value;
    } else if (item.source === 'BAR') {
      barRevenue += value;
    } else if (['POS', 'RESTAURANT'].includes(item.source)) {
      fbRevenue += value;
    } else {
      otherRevenue += value;
    }
  }

  return {
    totalRevenue: roomRevenue + fbRevenue + barRevenue + otherRevenue,
    roomRevenue,
    fbRevenue,
    barRevenue,
    otherRevenue
  };
}

/**
 * Authoritative Occupancy and Room Statistics Calculation.
 * Accounts for OUT_OF_ORDER blocks reducing available inventory.
 */
export async function calculateRoomStats(propertyId: string, businessDate: Date) {
  // 1. Total active physical rooms
  const totalRooms = await prisma.room.count({
    where: {
      propertyId,
      isActive: true,
    }
  });

  // 2. Rooms Out Of Order (reduces available inventory)
  const outOfOrderRooms = await prisma.roomBlock.count({
    where: {
      propertyId,
      type: 'OUT_OF_ORDER',
      status: 'ACTIVE',
      startDate: { lte: businessDate },
      endDate: { gte: businessDate },
    }
  });

  const availableRooms = Math.max(0, totalRooms - outOfOrderRooms);

  // 3. Occupied Rooms (Reservations crossing this date that are not cancelled/no-show)
  const occupiedRooms = await prisma.reservationRoom.count({
    where: {
      reservation: { propertyId },
      checkIn: { lte: businessDate },
      checkOut: { gt: businessDate }, // gt because checkout day is not occupied
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    }
  });

  const occupancyPercent = availableRooms > 0 ? (occupiedRooms / availableRooms) * 100 : 0;

  return {
    availableRooms,
    occupiedRooms,
    outOfOrderRooms,
    occupancyPercent: Number(occupancyPercent.toFixed(1))
  };
}

/**
 * Master function to fetch the complete Executive KPI Snapshot
 */
export async function getExecutiveKPISnapshot(propertyId: string, targetDate?: Date): Promise<KPISnapshot> {
  const date = targetDate || await getPropertyBusinessDate(propertyId);
  
  const [revenue, roomStats] = await Promise.all([
    calculateDailyRevenue(propertyId, date),
    calculateRoomStats(propertyId, date)
  ]);

  const adr = roomStats.occupiedRooms > 0 
    ? revenue.roomRevenue / roomStats.occupiedRooms 
    : 0;
    
  const revpar = roomStats.availableRooms > 0 
    ? revenue.roomRevenue / roomStats.availableRooms 
    : 0;

  return {
    occupancyPercent: roomStats.occupancyPercent,
    adr: Number(adr.toFixed(2)),
    revpar: Number(revpar.toFixed(2)),
    availableRooms: roomStats.availableRooms,
    occupiedRooms: roomStats.occupiedRooms,
    revenue
  };
}

/**
 * Efficiently aggregates revenue over a trailing number of business days.
 */
export async function getExecutiveRevenueTrend(propertyId: string, endBusinessDate: Date, days: number = 7) {
  const startBusinessDate = new Date(endBusinessDate);
  startBusinessDate.setDate(startBusinessDate.getDate() - days);

  const folioItems = await prisma.folioItem.findMany({
    where: {
      folio: { propertyId },
      businessDate: {
        gt: startOfDay(startBusinessDate),
        lte: endOfDay(endBusinessDate),
      },
      type: { in: ['CHARGE', 'DISCOUNT'] },
      voidedAt: null,
    },
    select: {
      amount: true,
      type: true,
      businessDate: true
    }
  });

  // Group by date string (yyyy-MM-dd)
  const dailyTotals = new Map<string, number>();
  let totalRevenue = 0;

  for (const item of folioItems) {
    if (!item.businessDate) continue;
    const dateStr = format(item.businessDate, 'yyyy-MM-dd');
    const amt = Number(item.amount);
    const sign = item.type === 'CHARGE' ? 1 : -1;
    const value = amt * sign;

    dailyTotals.set(dateStr, (dailyTotals.get(dateStr) || 0) + value);
    // Don't add total revenue here, we only want the exact N days requested.
  }

  // Construct the timeline strictly for the requested days
  const trendDays = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endBusinessDate);
    d.setDate(d.getDate() - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayRev = dailyTotals.get(dateStr) || 0;
    
    trendDays.push({
      businessDate: dateStr,
      revenue: dayRev
    });
    totalRevenue += dayRev;
  }

  return {
    days: trendDays,
    total: totalRevenue,
    changePercent: 0 // Placeholder until period-over-period is requested
  };
}

import { Prisma, PrismaClient } from '@prisma/client';

type TxClient = Prisma.TransactionClient | PrismaClient;

export interface AvailabilityResult {
  roomTypeId: string;
  totalRooms: number;
  blockedRooms: number;
  reservedRooms: number;
  activeHolds: number;
  availableRooms: number;
  isAvailable: boolean;
}

export interface AssignableRoom {
  id: string;
  number: string;
  roomTypeId: string;
}

const permanentlyUnavailableStatuses = ['OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'];
const activeReservationStatuses = ['CONFIRMED', 'CHECKED_IN', 'PENDING'];

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isSameUtcDay(left: Date, right: Date): boolean {
  return startOfUtcDay(left).getTime() === startOfUtcDay(right).getTime();
}

function validateDateRange(checkIn: Date, checkOut: Date): void {
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) {
    throw new Error('checkOut must be after checkIn');
  }
}

function roomInventoryWhere(opts: { propertyId: string; roomTypeId: string }) {
  return {
    propertyId: opts.propertyId,
    roomTypeId: opts.roomTypeId,
    isActive: true,
    deletedAt: null,
    status: { notIn: permanentlyUnavailableStatuses },
    roomType: { isActive: true, deletedAt: null },
  };
}

function currentOperationalRoomWhere(checkIn: Date) {
  // A room occupied/dirty today can be sellable on a future date after its
  // current stay or operational issue has ended. For today's arrivals, keep
  // the stricter PMS readiness rules.
  if (!isSameUtcDay(checkIn, new Date())) return {};
  return {
    status: 'AVAILABLE',
    housekeepingStatus: { in: ['CLEAN', 'INSPECTED'] },
    maintenanceStatus: { in: ['NONE', 'COMPLETED'] },
  };
}

function overlappingReservationWhere(dayStart: Date, dayEnd: Date, propertyId: string) {
  return {
    status: 'ACTIVE',
    checkIn: { lt: dayEnd },
    checkOut: { gt: dayStart },
    reservation: {
      propertyId,
      status: { in: activeReservationStatuses },
      deletedAt: null,
    },
  };
}

async function dailyAvailability(
  db: any,
  opts: { propertyId: string; roomTypeId: string; dayStart: Date; dayEnd: Date; excludeHoldId?: string }
) {
  const inventoryWhere = roomInventoryWhere(opts);
  const [inventoryRows, blockedRoomRows, reservationRows, holdRows] = await Promise.all([
    db.room.findMany({
      where: inventoryWhere,
      select: { id: true, status: true, housekeepingStatus: true, maintenanceStatus: true },
    }),
    db.room.findMany({
      where: {
        ...inventoryWhere,
        roomBlocks: {
          some: {
            status: 'ACTIVE',
            startDate: { lt: opts.dayEnd },
            endDate: { gt: opts.dayStart },
          },
        },
      },
      select: { id: true },
    }),
    db.reservationRoom.findMany({
      where: {
        roomTypeId: opts.roomTypeId,
        ...overlappingReservationWhere(opts.dayStart, opts.dayEnd, opts.propertyId),
      },
      select: { roomId: true },
    }),
    db.bookingHold.findMany({
      where: {
        propertyId: opts.propertyId,
        roomTypeId: opts.roomTypeId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        checkIn: { lt: opts.dayEnd },
        checkOut: { gt: opts.dayStart },
        ...(opts.excludeHoldId ? { id: { not: opts.excludeHoldId } } : {}),
      },
      select: { quantity: true },
    }),
  ]);

  const blockedRoomIds = new Set<string>(blockedRoomRows.map((room: { id: string }) => room.id));
  const inventoryRoomIds = new Set<string>(inventoryRows.map((room: { id: string }) => room.id));
  const assignedReservationRoomIds = new Set<string>(
    reservationRows
      .map((reservation: { roomId: string | null }) => reservation.roomId)
      .filter((roomId: string | null): roomId is string => Boolean(roomId))
  );
  const unassignedReservations = reservationRows.filter(
    (reservation: { roomId: string | null }) => !reservation.roomId
  ).length;

  const unavailableRoomIds = new Set<string>([
    ...blockedRoomIds,
    ...assignedReservationRoomIds,
  ]);
  if (isSameUtcDay(opts.dayStart, new Date())) {
    for (const room of inventoryRows) {
      const readyNow = room.status === 'AVAILABLE'
        && ['CLEAN', 'INSPECTED'].includes(room.housekeepingStatus)
        && ['NONE', 'COMPLETED'].includes(room.maintenanceStatus);
      if (!readyNow) unavailableRoomIds.add(room.id);
    }
  }

  const totalRooms = inventoryRows.length;
  const blockedRooms = blockedRoomIds.size;
  const reservedRooms = assignedReservationRoomIds.size + unassignedReservations;
  const assignedOutsideInventory = [...assignedReservationRoomIds]
    .filter((roomId) => !inventoryRoomIds.has(roomId)).length;
  const activeHolds = holdRows.reduce((sum: number, hold: { quantity: number }) => sum + hold.quantity, 0);
  const availableRooms = Math.max(
    0,
    totalRooms - unavailableRoomIds.size - assignedOutsideInventory - unassignedReservations - activeHolds
  );

  return { totalRooms, blockedRooms, reservedRooms, activeHolds, availableRooms };
}

export const AuthoritativeAvailabilityService = {
  async findAssignableRooms(
    tx: TxClient,
    opts: { propertyId: string; roomTypeId: string; checkIn: Date; checkOut: Date }
  ): Promise<AssignableRoom[]> {
    validateDateRange(opts.checkIn, opts.checkOut);
    const db = tx as any;
    return db.room.findMany({
      where: {
        ...roomInventoryWhere(opts),
        ...currentOperationalRoomWhere(opts.checkIn),
        roomBlocks: {
          none: {
            status: 'ACTIVE',
            startDate: { lt: opts.checkOut },
            endDate: { gt: opts.checkIn },
          },
        },
        reservationRooms: {
          none: overlappingReservationWhere(opts.checkIn, opts.checkOut, opts.propertyId),
        },
      },
      select: { id: true, number: true, roomTypeId: true },
      orderBy: [{ number: 'asc' }, { id: 'asc' }],
    });
  },

  async findAssignableRoom(
    tx: TxClient,
    opts: { propertyId: string; roomTypeId: string; checkIn: Date; checkOut: Date }
  ): Promise<AssignableRoom | null> {
    const rooms = await this.findAssignableRooms(tx, opts);
    return rooms[0] ?? null;
  },

  async check(
    tx: TxClient,
    opts: {
      propertyId: string;
      roomTypeId: string;
      checkIn: Date;
      checkOut: Date;
      excludeHoldId?: string;
    }
  ): Promise<AvailabilityResult> {
    validateDateRange(opts.checkIn, opts.checkOut);
    const db = tx as any;
    const firstNight = startOfUtcDay(opts.checkIn);
    const lastNight = startOfUtcDay(opts.checkOut);
    const daily: Array<Awaited<ReturnType<typeof dailyAvailability>>> = [];

    for (let night = firstNight; night < lastNight; night = addUtcDays(night, 1)) {
      daily.push(await dailyAvailability(db, {
        propertyId: opts.propertyId,
        roomTypeId: opts.roomTypeId,
        dayStart: night,
        dayEnd: addUtcDays(night, 1),
        excludeHoldId: opts.excludeHoldId,
      }));
    }

    const totalRooms = Math.max(...daily.map((item) => item.totalRooms));
    const blockedRooms = Math.max(...daily.map((item) => item.blockedRooms));
    const reservedRooms = Math.max(...daily.map((item) => item.reservedRooms));
    const activeHolds = Math.max(...daily.map((item) => item.activeHolds));
    const availableRooms = Math.min(...daily.map((item) => item.availableRooms));

    return {
      roomTypeId: opts.roomTypeId,
      totalRooms,
      blockedRooms,
      reservedRooms,
      activeHolds,
      availableRooms,
      isAvailable: availableRooms > 0,
    };
  },

  async checkMany(
    tx: TxClient,
    opts: { propertyId: string; roomTypeIds: string[]; checkIn: Date; checkOut: Date }
  ): Promise<Map<string, AvailabilityResult>> {
    const results = await Promise.all(opts.roomTypeIds.map((roomTypeId) =>
      AuthoritativeAvailabilityService.check(tx, { ...opts, roomTypeId })
    ));
    return new Map(results.map((result) => [result.roomTypeId, result]));
  },

  async assertAvailable(
    tx: TxClient,
    opts: {
      propertyId: string;
      roomTypeId: string;
      checkIn: Date;
      checkOut: Date;
      excludeHoldId?: string;
    }
  ): Promise<AvailabilityResult> {
    const result = await AuthoritativeAvailabilityService.check(tx, opts);
    if (!result.isAvailable) {
      const err = new Error(
        `No availability for room type ${opts.roomTypeId} from ${fmtDate(opts.checkIn)} to ${fmtDate(opts.checkOut)}. ` +
        `Total: ${result.totalRooms}, Blocked: ${result.blockedRooms}, Reserved: ${result.reservedRooms}, Held: ${result.activeHolds}.`
      );
      (err as any).code = 'BOOKING_UNAVAILABLE';
      throw err;
    }
    return result;
  },
};

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

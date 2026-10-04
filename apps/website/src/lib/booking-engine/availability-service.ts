import { Prisma, PrismaClient } from '@hotel-pms/db';

type TxClient = Prisma.TransactionClient | PrismaClient;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailabilityResult {
  roomTypeId: string;
  totalRooms: number;
  blockedRooms: number;
  reservedRooms: number;
  activeHolds: number;
  availableRooms: number;
  isAvailable: boolean;
}

// ---------------------------------------------------------------------------
// AuthoritativeAvailabilityService
//
// Single authority for room-type level availability queries.
//
// Formula:
//   available = totalSellableRooms
//             - blockedRooms    (RoomBlock on physical rooms, aggregated to type)
//             - reservedRooms   (ReservationRoom with active Reservation)
//             - activeHolds     (BookingHold — transient inventory locks)
//
// NOTE: The ReservationRoom_no_overlap DB exclusion constraint only covers
// roomId (physical room assignment). Room-type overbooking is prevented
// purely at the application layer — this service is the enforcement point.
// All callers that create holds or reservations MUST check this service
// inside the same serializable transaction.
// ---------------------------------------------------------------------------

export const AuthoritativeAvailabilityService = {
  /**
   * Check availability for a single room type over a date range.
   *
   * @param tx        Must be a transaction client when used for hold/reservation
   *                  creation to prevent TOCTOU race conditions.
   * @param opts      Query parameters.
   */
  async check(
    tx: TxClient,
    opts: {
      propertyId: string;
      roomTypeId: string;
      checkIn: Date;
      checkOut: Date;
      /** Exclude this hold ID from the active-holds count (used when converting a hold) */
      excludeHoldId?: string;
    }
  ): Promise<AvailabilityResult> {
    const { propertyId, roomTypeId, checkIn, checkOut, excludeHoldId } = opts;

    const db = tx as any;

    // 1. Count only rooms that are actually sellable. An active room record
    //    is not necessarily bookable: occupied, reserved, dirty, cleaning,
    //    blocked, out-of-order, out-of-service, and maintenance rooms must
    //    never enter online inventory.
    const sellableRoomWhere = {
      propertyId,
      roomTypeId,
      isActive: true,
      roomType: { isActive: true, deletedAt: null },
      status: 'AVAILABLE',
      housekeepingStatus: { in: ['CLEAN', 'INSPECTED'] },
      maintenanceStatus: { in: ['NONE', 'COMPLETED'] },
    };

    const totalRooms: number = await db.room.count({
      where: sellableRoomWhere,
    });

    // 2. Physically blocked rooms (RoomBlock on individual rooms, aggregated)
    //    RoomBlock is per physical room, so we count rooms that have an
    //    overlapping active block.
    const blockedRooms: number = await db.room.count({
      where: {
        ...sellableRoomWhere,
        roomBlocks: {
          some: {
            startDate: { lt: checkOut },
            endDate:   { gt: checkIn },
            // RoomBlock has no status field in the current schema —
            // any overlapping block is treated as active.
          },
        },
      },
    });

    // 3. Reserved rooms (ReservationRoom records for active reservations)
    //    PENDING is included because a Booking Engine reservation starts as
    //    PENDING while Paystack payment is being verified — it must still
    //    block inventory during that window.
    const reservedRooms: number = await db.reservationRoom.count({
      where: {
        roomTypeId,
        status: 'ACTIVE',
        checkIn:  { lt: checkOut },
        checkOut: { gt: checkIn },
        reservation: {
          propertyId,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          deletedAt: null,
        },
      },
    });

    // 4. Active booking holds (Booking Engine transient locks)
    const holdWhere: Record<string, any> = {
      propertyId,
      roomTypeId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
      checkIn:  { lt: checkOut },
      checkOut: { gt: checkIn },
    };
    if (excludeHoldId) {
      holdWhere.id = { not: excludeHoldId };
    }
    const activeHolds: number = await db.bookingHold.count({
      where: holdWhere,
    });

    const availableRooms = Math.max(
      0,
      totalRooms - blockedRooms - reservedRooms - activeHolds
    );

    return {
      roomTypeId,
      totalRooms,
      blockedRooms,
      reservedRooms,
      activeHolds,
      availableRooms,
      isAvailable: availableRooms > 0,
    };
  },

  /**
   * Batch availability check across multiple room types for the same date range.
   * Returns a map of roomTypeId → AvailabilityResult.
   */
  async checkMany(
    tx: TxClient,
    opts: {
      propertyId: string;
      roomTypeIds: string[];
      checkIn: Date;
      checkOut: Date;
    }
  ): Promise<Map<string, AvailabilityResult>> {
    const results = await Promise.all(
      opts.roomTypeIds.map((roomTypeId) =>
        AuthoritativeAvailabilityService.check(tx, {
          propertyId: opts.propertyId,
          roomTypeId,
          checkIn: opts.checkIn,
          checkOut: opts.checkOut,
        })
      )
    );
    return new Map(results.map((r) => [r.roomTypeId, r]));
  },

  /**
   * Assert that inventory is available, throwing a typed error if not.
   * Must be called inside a transaction for correctness.
   *
   * @throws BOOKING_UNAVAILABLE if the room type is not available.
   */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

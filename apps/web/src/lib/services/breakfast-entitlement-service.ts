import { prisma } from '@hotel-pms/db';
import { resolveBreakdownConfig } from '@/lib/room-rate-breakdown';

export type BreakfastIneligibilityReason =
  | 'NOT_IN_HOUSE'
  | 'FOOD_SUPPRESSED_DISCOUNT'
  | 'FOOD_EXCLUDED_CORPORATE'
  | 'COVERS_EXHAUSTED'
  | 'INVALID_DATE';

export interface BreakfastEntitlementResult {
  eligible: boolean;
  reason?: BreakfastIneligibilityReason;
  reasonMessage?: string;
  roomNumber: string;
  guestName: string;
  reservationId: string;
  businessDate: string;
  maxCoversAllowed: number;
  coversAlreadyRedeemed: number;
  remainingCovers: number;
}

export interface CheckEntitlementParams {
  propertyId: string;
  roomNumber?: string;
  reservationId?: string;
  businessDate?: Date | string;
}

export interface RecordRedemptionParams {
  propertyId: string;
  reservationId: string;
  roomNumber: string;
  businessDate: Date | string;
  coversRedeemed: number;
  posOrderId?: string;
  serverStaffId?: string;
  method?: 'POS_TICKET' | 'BUFFET_BATCH';
  operationId: string;
}

export class BreakfastEntitlementService {
  /**
   * Normalizes any input date to midnight UTC for stable date comparisons.
   */
  private static normalizeDate(dateInput?: Date | string): Date {
    const d = dateInput ? new Date(dateInput) : new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Checks complimentary breakfast eligibility for a given room or reservation.
   * Server-side authority for POS settlement screens and validation.
   */
  static async checkEntitlement(
    params: CheckEntitlementParams,
    clientTx?: any,
  ): Promise<BreakfastEntitlementResult> {
    const db = clientTx || prisma;
    const { propertyId, roomNumber, reservationId } = params;

    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, businessDate: true, settings: true, timezone: true },
    });

    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    const targetDate = this.normalizeDate(
      params.businessDate || property.businessDate || new Date(),
    );
    const dateStr = targetDate.toISOString().split('T')[0];

    // Find reservation by reservationId or by roomNumber in-house
    let reservation: any = null;

    if (reservationId) {
      reservation = await db.reservation.findFirst({
        where: {
          id: reservationId,
          propertyId,
        },
        include: {
          primaryGuest: true,
          reservationRooms: {
            where: { status: 'ACTIVE' },
            include: { room: true },
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          },
          ratePlan: true,
          corporateAccount: { include: { ratePlan: true } },
        },
      });
    } else if (roomNumber) {
      const room = await db.room.findFirst({
        where: { propertyId, number: roomNumber.trim() },
        select: { id: true, number: true },
      });

      if (room) {
        reservation = await db.reservation.findFirst({
          where: {
            propertyId,
            status: 'CHECKED_IN',
            reservationRooms: {
              some: {
                roomId: room.id,
                status: 'ACTIVE',
              },
            },
          },
          include: {
            primaryGuest: true,
            reservationRooms: {
              where: { status: 'ACTIVE' },
              include: { room: true },
              orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            },
            ratePlan: true,
            corporateAccount: { include: { ratePlan: true } },
          },
        });
      }
    }

    // 1. Verify In-House status
    if (!reservation || reservation.status !== 'CHECKED_IN') {
      return {
        eligible: false,
        reason: 'NOT_IN_HOUSE',
        reasonMessage: 'No checked-in reservation found for this room.',
        roomNumber: roomNumber || '',
        guestName: '',
        reservationId: reservationId || '',
        businessDate: dateStr,
        maxCoversAllowed: 0,
        coversAlreadyRedeemed: 0,
        remainingCovers: 0,
      };
    }

    const activeRoom = reservation.reservationRooms?.[0] || null;
    const resolvedRoomNumber = activeRoom?.room?.number || roomNumber || '';
    const guestName = `${reservation.primaryGuest?.firstName || ''} ${reservation.primaryGuest?.lastName || ''}`.trim() || 'In-House Guest';

    // 2. Resolve Rate Breakdown Configuration & Policy Rules
    const breakdownConfig = resolveBreakdownConfig(property.settings as any);
    const corporateRatePlan =
      reservation.corporateAccount?.ratePlan ||
      (reservation.ratePlan?.type === 'CORPORATE' ? reservation.ratePlan : null);
    const corporateFoodOverride = corporateRatePlan
      ? Boolean(corporateRatePlan.includeFoodAllocation)
      : null;

    // Check discount status
    const isDiscountedStay =
      Boolean(activeRoom?.discountType) ||
      Boolean(activeRoom?.discountAmount && Number(activeRoom.discountAmount) > 0);

    // Rule 1: Corporate rate contract override takes absolute precedence
    if (typeof corporateFoodOverride === 'boolean') {
      if (!corporateFoodOverride) {
        return {
          eligible: false,
          reason: 'FOOD_EXCLUDED_CORPORATE',
          reasonMessage: 'Complimentary breakfast is excluded under this corporate rate agreement.',
          roomNumber: resolvedRoomNumber,
          guestName,
          reservationId: reservation.id,
          businessDate: dateStr,
          maxCoversAllowed: 0,
          coversAlreadyRedeemed: 0,
          remainingCovers: 0,
        };
      }
    } else if (isDiscountedStay && !breakdownConfig.allowComplimentaryFoodOnDiscountedRooms) {
      // Rule 2: Discounted rooms forfeit complimentary food unless explicitly permitted by accountant
      return {
        eligible: false,
        reason: 'FOOD_SUPPRESSED_DISCOUNT',
        reasonMessage: 'Complimentary breakfast is suppressed on discounted room rates.',
        roomNumber: resolvedRoomNumber,
        guestName,
        reservationId: reservation.id,
        businessDate: dateStr,
        maxCoversAllowed: 0,
        coversAlreadyRedeemed: 0,
        remainingCovers: 0,
      };
    }

    // 3. Determine Allowed Covers vs. Already Redeemed
    // Entitlement covers are based on registered adult occupancy (default 1, max adults)
    const maxCoversAllowed = Math.max(1, reservation.adults || 1);

    const existingRedemptions = await db.breakfastRedemption.findMany({
      where: {
        propertyId,
        reservationId: reservation.id,
        businessDate: targetDate,
      },
    });

    const coversAlreadyRedeemed = existingRedemptions.reduce(
      (sum: number, r: any) => sum + r.coversRedeemed,
      0,
    );
    const remainingCovers = Math.max(0, maxCoversAllowed - coversAlreadyRedeemed);

    if (remainingCovers <= 0) {
      return {
        eligible: false,
        reason: 'COVERS_EXHAUSTED',
        reasonMessage: `All ${maxCoversAllowed} complimentary breakfast cover(s) for today have already been redeemed.`,
        roomNumber: resolvedRoomNumber,
        guestName,
        reservationId: reservation.id,
        businessDate: dateStr,
        maxCoversAllowed,
        coversAlreadyRedeemed,
        remainingCovers: 0,
      };
    }

    return {
      eligible: true,
      roomNumber: resolvedRoomNumber,
      guestName,
      reservationId: reservation.id,
      businessDate: dateStr,
      maxCoversAllowed,
      coversAlreadyRedeemed,
      remainingCovers,
    };
  }

  /**
   * Transactionally records a breakfast redemption, enforcing concurrency guards
   * and preventing duplicate redemptions.
   */
  static async recordRedemption(
    params: RecordRedemptionParams,
    clientTx?: any,
  ) {
    if (!params.operationId || params.operationId.trim().length < 8) {
      throw new Error('STABLE_OPERATION_ID_REQUIRED: Breakfast redemption must include a stable operationId.');
    }
    if (!Number.isInteger(params.coversRedeemed) || params.coversRedeemed < 1) {
      throw new Error('INVALID_COVERS: Breakfast redemption covers must be a positive integer.');
    }

    const execute = async (tx: any) => {
      const targetDate = this.normalizeDate(params.businessDate);
      const dateStr = targetDate.toISOString().split('T')[0];

      // 1. Transaction-level advisory lock: strictly serializes concurrent claims
      // for this reservation and date across all instances/workers.
      const lockKey = `breakfast:${params.propertyId}:${params.reservationId}:${dateStr}`;
      if (typeof tx.$executeRaw !== 'function') {
        throw new Error('TRANSACTION_LOCK_REQUIRED: PostgreSQL transaction locking is required for breakfast redemption.');
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // 2. Idempotency check: if already recorded with this operationId, return existing
      const existingByOp = await tx.breakfastRedemption.findUnique({
        where: { operationId: params.operationId },
      });
      if (existingByOp) {
        return existingByOp;
      }

      // 3. Re-verify entitlement inside locked transaction with fresh count
      const check = await this.checkEntitlement(
        {
          propertyId: params.propertyId,
          reservationId: params.reservationId,
          businessDate: targetDate,
        },
        tx,
      );

      if (!check.eligible) {
        throw new Error(`REDEMPTION_DENIED:${check.reason || 'NOT_ELIGIBLE'} - ${check.reasonMessage}`);
      }

      if (params.coversRedeemed > check.remainingCovers) {
        throw new Error(
          `COVERS_EXHAUSTED:Requested ${params.coversRedeemed} cover(s) exceeds remaining entitlement of ${check.remainingCovers}`,
        );
      }

      const redemption = await tx.breakfastRedemption.create({
        data: {
          propertyId: params.propertyId,
          reservationId: params.reservationId,
          roomNumber: params.roomNumber,
          businessDate: targetDate,
          coversRedeemed: params.coversRedeemed,
          posOrderId: params.posOrderId || null,
          method: params.method || 'POS_TICKET',
          serverStaffId: params.serverStaffId || null,
          operationId: params.operationId,
        },
      });

      return redemption;
    };

    if (clientTx) {
      return execute(clientTx);
    }
    return prisma.$transaction(execute);
  }
}

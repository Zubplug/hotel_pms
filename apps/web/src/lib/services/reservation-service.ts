import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { Prisma } from '@hotel-pms/db';

export interface CreateReservationParams {
  propertyId: string;
  organizationId: string;
  guestId?: string;
  guestDetails?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    country?: string;
  };
  checkIn: Date;
  checkOut: Date;
  roomTypeId: string;
  roomId?: string | null;
  adults: number;
  children: number;
  corporateAccountId?: string | null;
  
  // Rate & Financial
  ratePlanId?: string;
  overrideTotalAmount?: number;
  currency?: string;
  adjustmentType?: string;
  adjustmentValue?: number;
  adjustmentReason?: string;
  acknowledgedByStaffId?: string;

  // Metadata
  source?: string;
  status?: string;
  confirmationNumber?: string;
  specialRequests?: string;

  // Audit
  createdBy: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;

  tx?: Prisma.TransactionClient;
}

export const SharedReservationService = {
  async createReservation(params: CreateReservationParams) {
    const {
      propertyId, organizationId, guestId, guestDetails,
      checkIn, checkOut, roomTypeId, roomId, adults, children,
      corporateAccountId, ratePlanId, overrideTotalAmount,
      adjustmentType, adjustmentValue, adjustmentReason,
      acknowledgedByStaffId,
      source = 'WALK_IN', status = 'CONFIRMED',
      confirmationNumber, specialRequests,
      createdBy, userEmail = 'system', userRole = 'SYSTEM',
      ipAddress = '127.0.0.1', userAgent = 'System', requestId = crypto.randomUUID(),
      tx: externalTx
    } = params;

    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    let room;
    if (roomId) {
      room = await (externalTx || prisma).room.findFirst({
        where: { id: roomId, propertyId, roomTypeId },
        include: { roomType: true },
      });
      if (!room) throw new Error('Room not found or does not belong to property/room type');
    }

    const roomType = await (externalTx || prisma).roomType.findUnique({
      where: { id: roomTypeId }
    });
    if (!roomType) throw new Error('Room Type not found');

    let baseRate = roomType.baseRate;
    const currency = params.currency || roomType.currency || 'USD';
    let finalRatePlanId = ratePlanId;

    if (corporateAccountId) {
      const corporateAccount = await (externalTx || prisma).corporateAccount.findUnique({
        where: { id: corporateAccountId },
        include: { ratePlan: true }
      });
      if (corporateAccount?.ratePlan) {
        finalRatePlanId = corporateAccount.ratePlan.id;
        const rate = await (externalTx || prisma).rate.findFirst({
          where: { ratePlanId: finalRatePlanId, roomTypeId }
        });
        if (rate && (rate as any).amount) {
          baseRate = (rate as any).amount;
        } else if (rate && (rate as any).baseAmount) {
          baseRate = (rate as any).baseAmount;
        }
      }
    }

    if (!finalRatePlanId) {
      const defaultRatePlan = await (externalTx || prisma).ratePlan.findFirst({
        where: { propertyId }
      });
      if (defaultRatePlan) finalRatePlanId = defaultRatePlan.id;
    }

    const totalAmount = overrideTotalAmount !== undefined ? overrideTotalAmount : Number(baseRate) * nights;

    const performTransaction = async (tx: any) => {
      let finalGuestId = guestId;
      if (!finalGuestId && guestDetails) {
        const newGuest = await tx.guest.create({
          data: {
            organizationId,
            propertyId,
            firstName: guestDetails.firstName,
            lastName: guestDetails.lastName,
            email: guestDetails.email,
            phone: guestDetails.phone,
            country: guestDetails.country,
          },
        });
        finalGuestId = newGuest.id;
      } else if (finalGuestId) {
        const existingGuest = await tx.guest.findUnique({ where: { id: finalGuestId } });
        if (!existingGuest || existingGuest.propertyId !== propertyId) {
          throw new Error('Guest not found or does not belong to this property');
        }
      } else {
         throw new Error('Either guestId or guestDetails must be provided');
      }

      const finalConfirmation = confirmationNumber || ('RES-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'));

      const newRes = await tx.reservation.create({
        data: { 
          propertyId,
          primaryGuestId: finalGuestId as string,
          confirmationNumber: finalConfirmation,
          source: source as any,
          status: status as any,
          checkIn,
          checkOut,
          adults,
          children,
          ratePlanId: finalRatePlanId,
          ratePlanSnapshot: { baseRate, total: totalAmount, currency },
          currency: currency,
          corporateAccountId: corporateAccountId || null,
          createdBy,
        },
      });

      await tx.reservationGuest.create({
        data: {
          reservationId: newRes.id,
          guestId: finalGuestId,
          isPrimary: true,
        },
      });

      const createdReservationRoom = await tx.reservationRoom.create({
        data: {
          reservationId: newRes.id,
          roomId: roomId || null,
          roomTypeId: roomTypeId,
          status: 'ACTIVE',
          checkIn,
          checkOut,
          adults,
          children,
          ratePlanId: newRes.ratePlanId,
          rateAmount: baseRate,
          currency: currency,
          discountType: (adjustmentType === 'COMP_FULL' || adjustmentType === 'COMP_PARTIAL') ? 'COMPLIMENTARY'
                      : adjustmentType === 'DISCOUNT_PERCENTAGE' ? 'PERCENTAGE'
                      : adjustmentType === 'DISCOUNT_FIXED' ? 'FIXED_AMOUNT'
                      : null,
          discountPercent: adjustmentType === 'DISCOUNT_PERCENTAGE' ? Number(adjustmentValue) : null,
          discountAmount: adjustmentType === 'DISCOUNT_FIXED' ? Number(adjustmentValue)
                        : (adjustmentType === 'COMP_FULL' || adjustmentType === 'COMP_PARTIAL') ? (adjustmentType === 'COMP_FULL' ? baseRate : Number(adjustmentValue))
                        : null,
          discountReason: adjustmentReason || null,
        },
      });

      if (adjustmentType === 'DISCOUNT_PERCENTAGE' || adjustmentType === 'DISCOUNT_FIXED') {
        if (!acknowledgedByStaffId) {
          throw new Error('Acknowledging staff is required for discounted reservations');
        }
        const operator = await tx.staff.findFirst({
          where: { id: createdBy, propertyAccess: { has: propertyId }, isActive: true },
          select: { id: true },
        });
        if (!operator) throw new Error('Discount reservation operator is not an active staff member');
        const discountValue = Number(adjustmentValue || 0);
        if (adjustmentType === 'DISCOUNT_FIXED' && (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > Number(baseRate))) {
          throw new Error('Invalid fixed discount amount');
        }
        if (adjustmentType === 'DISCOUNT_PERCENTAGE' && (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100)) {
          throw new Error('Invalid discount percentage');
        }
        const approval = await tx.approvalRequest.create({
          data: {
            propertyId,
            type: 'DISCOUNT',
            status: 'PENDING',
            executionStatus: 'NOT_APPLIED',
            requestedBy: operator.id,
            amount: adjustmentType === 'DISCOUNT_FIXED' ? discountValue : 0,
            currency,
            reason: adjustmentReason || 'Guest reservation discount',
            details: { targetType: 'RESERVATION_ROOM', reservationId: newRes.id, reservationRoomId: createdReservationRoom.id, acknowledgedByStaffId },
            snapshot: {
              targetType: 'RESERVATION_ROOM',
              reservationRoomId: createdReservationRoom.id,
              originalRate: Number(baseRate),
              discountType: adjustmentType === 'DISCOUNT_FIXED' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
              discountAmount: adjustmentType === 'DISCOUNT_FIXED' ? discountValue : 0,
              discountPercent: adjustmentType === 'DISCOUNT_PERCENTAGE' ? discountValue : 0,
              reason: adjustmentReason || 'Guest reservation discount',
            },
            idempotencyKey: `DISCOUNT_CREATE:${newRes.id}`,
          },
        });
        await tx.reservationRoom.update({
          where: { id: createdReservationRoom.id },
          data: { discountApprovalId: `PENDING:${approval.id}` },
        });
      }

      if (adjustmentType === 'COMP_FULL' || adjustmentType === 'COMP_PARTIAL') {
        if (!acknowledgedByStaffId) {
          throw new Error('Acknowledging staff is required for complimentary reservations');
        }
        const operator = await tx.staff.findFirst({
          where: { id: createdBy, propertyAccess: { has: propertyId }, isActive: true },
          select: { id: true },
        });
        if (!operator) throw new Error('Complimentary reservation operator is not an active staff member');
        const complimentaryAmount = adjustmentType === 'COMP_FULL'
          ? Number(baseRate)
          : Number(adjustmentValue || 0);
        if (!Number.isFinite(complimentaryAmount) || complimentaryAmount <= 0 || complimentaryAmount > Number(baseRate)) {
          throw new Error('Invalid complimentary amount');
        }
        const propertyForComp = await tx.property.findUnique({ where: { id: propertyId }, select: { businessDate: true } });
        await tx.complimentaryRecord.create({
          data: {
            propertyId,
            businessDate: propertyForComp?.businessDate || new Date(),
            reference: `COMP_RES_${newRes.id}_${checkIn.toISOString().slice(0, 10)}`,
            sourceModule: 'FRONT_DESK',
            roomId: roomId || null,
            guestId: finalGuestId,
            operatorId: operator.id,
            operationId: `COMP_CREATE_${newRes.id}`,
            grossAmount: complimentaryAmount,
            complAmount: complimentaryAmount,
            netAmount: 0,
            complType: adjustmentType === 'COMP_FULL' ? 'FULL' : 'PARTIAL',
            reason: adjustmentReason || 'Guest complimentary reservation',
            notes: JSON.stringify({ acknowledgedByStaffId }),
          },
        });
      }

      if (roomId) {
        const prop = await tx.property.findUnique({ where: { id: propertyId } });
        const propertyBusinessDateStr = (prop?.businessDate ?? new Date()).toISOString().split('T')[0];
        const checkInStr = checkIn.toISOString().split('T')[0];
        
        if (checkInStr === propertyBusinessDateStr) {
          await tx.room.update({
            where: { id: roomId },
            data: { status: 'RESERVED' },
          });
        }
      }

      // Folio
      const existingCorporateFolio = corporateAccountId
        ? await tx.folio.findFirst({
            where: { propertyId, corporateAccountId, type: 'CITY_LEDGER', status: 'OPEN' },
          })
        : null;
      
      const newFolio = existingCorporateFolio ?? await tx.folio.create({
        data: {
          reservationId: corporateAccountId ? null : newRes.id,
          corporateAccountId: corporateAccountId || null,
          propertyId,
          guestId: corporateAccountId ? null : finalGuestId,
          folioNumber: 'FOL-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
          type: corporateAccountId ? 'CITY_LEDGER' : 'ROOM',
          status: 'OPEN',
          currency,
          totalCharges: 0,
          totalPayments: 0,
          balance: 0,
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          propertyId,
          userId: createdBy,
          userEmail,
          userRole,
          action: 'RESERVATION_CREATED',
          resource: 'Reservation',
          resourceId: newRes.id,
          newValue: {
            confirmationNumber: finalConfirmation,
            propertyId,
            guestId: finalGuestId,
            roomId: roomId || null,
            roomTypeId,
            checkIn: checkIn.toISOString(),
            checkOut: checkOut.toISOString(),
            adults,
            children,
            status,
            totalAmount,
            currency
          },
          ipAddress,
          userAgent,
          requestId,
        },
      });

      return newRes;
    };

    if (externalTx) {
        return performTransaction(externalTx);
    } else {
        return prisma.$transaction(performTransaction);
    }
  },

  async modifyReservation(reservationId: string, params: Partial<CreateReservationParams> & { tx?: Prisma.TransactionClient }) {
    const performTransaction = async (tx: any) => {
        const existing = await tx.reservation.findUnique({
            where: { id: reservationId },
            include: { reservationRooms: true }
        });
        if (!existing) throw new Error('Reservation not found');

        const checkIn = params.checkIn || existing.checkIn;
        const checkOut = params.checkOut || existing.checkOut;
        const adults = params.adults !== undefined ? params.adults : existing.adults;
        const children = params.children !== undefined ? params.children : existing.children;
        const totalAmount = params.overrideTotalAmount !== undefined ? params.overrideTotalAmount : (existing.ratePlanSnapshot as any).total;
        const status = params.status || existing.status;

        const updated = await tx.reservation.update({
            where: { id: reservationId },
            data: {
                checkIn,
                checkOut,
                adults,
                children,
                status: status as any,
                ratePlanSnapshot: { ...(existing.ratePlanSnapshot as any), total: totalAmount }
            }
        });

        const resRoom = existing.reservationRooms[0];
        if (resRoom) {
            await tx.reservationRoom.update({
                where: { id: resRoom.id },
                data: {
                    checkIn,
                    checkOut,
                    adults,
                    children,
                    roomTypeId: params.roomTypeId || resRoom.roomTypeId
                }
            });
        }

        await tx.auditLog.create({
            data: {
                organizationId: params.organizationId || existing.propertyId, // fallback
                propertyId: existing.propertyId,
                userId: params.createdBy || 'SYSTEM',
                userEmail: params.userEmail || 'system',
                userRole: params.userRole || 'SYSTEM',
                action: 'RESERVATION_MODIFIED',
                resource: 'Reservation',
                resourceId: reservationId,
                newValue: { checkIn, checkOut, adults, children, status, totalAmount },
                ipAddress: params.ipAddress || '127.0.0.1',
                userAgent: params.userAgent || 'System',
                requestId: params.requestId || crypto.randomUUID(),
            }
        });
        return updated;
    };

    if (params.tx) {
        return performTransaction(params.tx);
    } else {
        return prisma.$transaction(performTransaction);
    }
  },

  async cancelReservation(reservationId: string, params: { createdBy: string, organizationId: string, ipAddress?: string, userAgent?: string, tx?: Prisma.TransactionClient }) {
    const performTransaction = async (tx: any) => {
        const existing = await tx.reservation.findUnique({
            where: { id: reservationId },
            include: { reservationRooms: true }
        });
        if (!existing) throw new Error('Reservation not found');

        const updated = await tx.reservation.update({
            where: { id: reservationId },
            data: { status: 'CANCELLED' }
        });

        for (const room of existing.reservationRooms) {
            await tx.reservationRoom.update({
                where: { id: room.id },
                data: { status: 'CANCELLED' }
            });
        }

        await tx.auditLog.create({
            data: {
                organizationId: params.organizationId,
                propertyId: existing.propertyId,
                userId: params.createdBy,
                userEmail: 'system',
                userRole: 'SYSTEM',
                action: 'RESERVATION_CANCELLED',
                resource: 'Reservation',
                resourceId: reservationId,
                newValue: { status: 'CANCELLED' },
                ipAddress: params.ipAddress || '127.0.0.1',
                userAgent: params.userAgent || 'System',
                requestId: crypto.randomUUID(),
            }
        });
        return updated;
    };

    if (params.tx) {
        return performTransaction(params.tx);
    } else {
        return prisma.$transaction(performTransaction);
    }
  }
};

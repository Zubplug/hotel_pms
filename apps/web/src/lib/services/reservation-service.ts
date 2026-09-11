import prisma from '@hotel-pms/db';
import crypto from 'crypto';

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
  overrideTotalAmount?: number; // E.g., OTA forces total amount
  currency?: string;
  adjustmentType?: string;
  adjustmentValue?: number;
  adjustmentReason?: string;

  // Metadata
  source?: string; // e.g. WALK_IN, CHANNEX, BOOKING_ENGINE
  status?: string; // e.g. CONFIRMED
  confirmationNumber?: string;
  specialRequests?: string;

  // Audit
  createdBy: string; // Staff ID or System Actor UUID
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export const SharedReservationService = {
  async createReservation(params: CreateReservationParams) {
    const {
      propertyId, organizationId, guestId, guestDetails,
      checkIn, checkOut, roomTypeId, roomId, adults, children,
      corporateAccountId, ratePlanId, overrideTotalAmount,
      adjustmentType, adjustmentValue, adjustmentReason,
      source = 'WALK_IN', status = 'CONFIRMED',
      confirmationNumber, specialRequests,
      createdBy, userEmail = 'system', userRole = 'SYSTEM',
      ipAddress = '127.0.0.1', userAgent = 'System', requestId = crypto.randomUUID()
    } = params;

    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    // 1. Validate Room/RoomType and Rates
    let room;
    if (roomId) {
      room = await prisma.room.findFirst({
        where: { id: roomId, propertyId, roomTypeId },
        include: { roomType: true },
      });
      if (!room) throw new Error('Room not found or does not belong to property/room type');
    }

    const roomType = await prisma.roomType.findUnique({
      where: { id: roomTypeId }
    });
    if (!roomType) throw new Error('Room Type not found');

    let baseRate = roomType.baseRate;
    const currency = params.currency || roomType.currency || 'USD';
    let finalRatePlanId = ratePlanId;

    if (corporateAccountId) {
      const corporateAccount = await prisma.corporateAccount.findUnique({
        where: { id: corporateAccountId },
        include: { ratePlan: true }
      });
      if (corporateAccount?.ratePlan) {
        finalRatePlanId = corporateAccount.ratePlan.id;
        const rate = await prisma.rate.findFirst({
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
      const defaultRatePlan = await prisma.ratePlan.findFirst({
        where: { propertyId }
      });
      if (defaultRatePlan) finalRatePlanId = defaultRatePlan.id;
    }

    const totalAmount = overrideTotalAmount !== undefined ? overrideTotalAmount : Number(baseRate) * nights;

    // 2. Create the Reservation transactionally
    const newReservation = await prisma.$transaction(async (tx: any) => {
      // Resolve Guest
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

      // Special Requests handling (we can put it in Folio notes or add a field to Reservation if it exists. Wait, there's no specialRequests field in Reservation. I will skip unless there is a specific field for notes.)

      await tx.reservationRoom.create({
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
          userId: createdBy, // Now properly passed in
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
    });

    return newReservation;
  },

  async modifyReservation(reservationId: string, params: Partial<CreateReservationParams>) {
    // Implement modification logic
    return await prisma.$transaction(async (tx: any) => {
        const existing = await tx.reservation.findUnique({
            where: { id: reservationId },
            include: { reservationRooms: true }
        });
        if (!existing) throw new Error('Reservation not found');

        // Note: Full modification engine is complex (rates, folios, dates).
        // Since OTA modifications usually touch dates, occupancy, or totalAmount:
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

        // Update ReservationRoom
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

        // Audit Log
        await tx.auditLog.create({
            data: {
                organizationId: params.organizationId!,
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
    });
  },

  async cancelReservation(reservationId: string, params: { createdBy: string, organizationId: string, ipAddress?: string, userAgent?: string }) {
    return await prisma.$transaction(async (tx: any) => {
        const existing = await tx.reservation.findUnique({
            where: { id: reservationId },
            include: { reservationRooms: true }
        });
        if (!existing) throw new Error('Reservation not found');

        const updated = await tx.reservation.update({
            where: { id: reservationId },
            data: { status: 'CANCELLED' }
        });

        // Cancel Rooms
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
    });
  }
};

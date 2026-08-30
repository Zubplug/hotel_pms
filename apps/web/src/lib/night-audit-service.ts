import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';

export async function getOperationalReview(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');
  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());

  const arrivals = await prisma.reservation.findMany({
    where: { propertyId, checkIn: businessDate, status: 'CONFIRMED' },
    select: { id: true, status: true, checkIn: true, checkOut: true, confirmationNumber: true, primaryGuestId: true, primaryGuest: { select: { firstName: true, lastName: true } }, folios: { select: { balance: true } } }
  });

  const departures = await prisma.reservation.findMany({
    where: { propertyId, checkOut: businessDate, status: 'CHECKED_IN' },
    select: { id: true, status: true, checkIn: true, checkOut: true, confirmationNumber: true, primaryGuestId: true, primaryGuest: { select: { firstName: true, lastName: true } }, folios: { select: { balance: true } } }
  });

  const rooms = await prisma.room.findMany({
    where: { propertyId },
    select: { id: true, number: true, status: true, housekeepingStatus: true }
  });

  const activeRoomReservations = await prisma.reservationRoom.findMany({
    where: {
      reservation: { propertyId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      status: 'ACTIVE',
      roomId: { not: null },
      checkIn: { lte: businessDate },
      checkOut: { gt: businessDate },
    },
    select: { roomId: true, reservation: { select: { status: true } } },
  });
  const expectedByRoom = new Map(activeRoomReservations.map((reservationRoom) => [reservationRoom.roomId!, reservationRoom.reservation.status]));

  const roomReconciliation = rooms.map(room => {
    const reservationStatus = expectedByRoom.get(room.id);
    const expected = room.status === 'OUT_OF_ORDER'
      ? 'OOO'
      : reservationStatus === 'CHECKED_IN' ? 'OCCUPIED' : reservationStatus === 'CONFIRMED' ? 'RESERVED' : 'AVAILABLE';
    const pmsMismatch = expected !== 'OOO' && room.status !== expected;
    const housekeepingMismatch = expected === 'OCCUPIED'
      ? room.housekeepingStatus === 'INSPECTED'
      : expected === 'AVAILABLE' && room.housekeepingStatus === 'CLEANING';
    const issue = pmsMismatch || housekeepingMismatch;

    return {
      roomId: room.id,
      roomNumber: room.number,
      pmsStatus: room.status,
      hkStatus: room.housekeepingStatus,
      expected,
      issue
    };
  });

  return { arrivals, departures, roomReconciliation };
}

export async function getSystemIntegrity(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');
  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());

  const openPosSessions = await prisma.posSession.findMany({
    where: { propertyId, businessDate, status: { in: ['OPEN', 'RECONCILIATION_REQUIRED'] } },
    select: { id: true, outletId: true, outlet: { select: { name: true } }, status: true, openedAt: true }
  });

  const openFrontdeskSessions = await prisma.frontdeskSession.findMany({
    where: { propertyId, businessDate, status: { in: ['OPEN', 'CLOSING'] }, controlStatus: 'OPEN' },
    select: {
      id: true,
      shiftReference: true,
      status: true,
      controlStatus: true,
      openedAt: true,
      staff: { select: { firstName: true, lastName: true } },
    },
  });

  const syncConflicts = await prisma.syncConflict.findMany({
    where: { propertyId, status: 'PENDING' },
    include: { hotelEvent: true }
  });
  
  const financialSyncConflicts = syncConflicts.filter(c => {
    const et = c.hotelEvent?.eventType?.toUpperCase() || '';
    return et.includes('PAYMENT') || et.includes('CHARGE') || et.includes('REFUND') || c.aggregateType === 'FOLIO';
  });

  return { openPosSessions, openFrontdeskSessions, syncConflicts, financialSyncConflicts };
}

export async function getFinancialAudit(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');
  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());

  const openFolios = await prisma.folio.findMany({
    where: { propertyId, status: 'OPEN', balance: { not: 0 } },
    select: { 
      id: true, 
      folioNumber: true,
      balance: true, 
      reservationId: true, 
      reservation: { 
        select: { 
          confirmationNumber: true,
          primaryGuest: { select: { firstName: true, lastName: true } },
          reservationRooms: { select: { room: { select: { number: true } } }, take: 1 }
        } 
      },
      items: {
        select: {
          amount: true,
          businessDate: true,
          type: true
        }
      }
    }
  });

  // Flag folios whose balance exceeds the property-configured threshold.
  // Configurable via Property.nightAuditHighBalanceThreshold (default: 50,000).
  const highBalanceThreshold = Number(property.nightAuditHighBalanceThreshold ?? 50000);
  
  const highBalances = openFolios
    .map(f => {
      // Calculate consumed balance to avoid flagging guests for future room charges
      // Start with the full ledger balance
      let currentBalance = Number(f.balance);
      
      // Subtract any charges that are posted for future dates (after today's audit date)
      for (const item of f.items) {
        if (item.businessDate > businessDate) {
          if (item.type === 'CHARGE' || item.type === 'TAX') {
            currentBalance -= Number(item.amount);
          } else if (item.type === 'DISCOUNT') {
            currentBalance += Number(item.amount);
          }
        }
      }
      
      return {
        ...f,
        balance: currentBalance, // Override the display balance
        creditLimit: highBalanceThreshold
      };
    })
    .filter(f => f.balance > highBalanceThreshold);


  const roomCharges = await prisma.folioItem.findMany({
    where: { 
      folio: { propertyId }, 
      type: 'CHARGE', 
      // Night Audit posts room revenue with source ROOM_CHARGE. Keep the review
      // query aligned with the posting service so rate variance analysis
      // actually sees the charges generated by the audit.
      source: 'ROOM_CHARGE',
      businessDate 
    },
    include: { 
      folio: { 
        select: { 
          reservationId: true, 
          reservation: { 
            select: { 
              primaryGuest: { select: { firstName: true, lastName: true } } 
            } 
          } 
        } 
      } 
    }
  });
  
  const rateVariances = roomCharges.filter(charge => Number(charge.unitAmount) !== Number(charge.baseAmount));

  return { openFolios, highBalances, rateVariances };
}

export async function getCashReconciliation(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');
  
  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone);
  const nextBusinessDate = getNextBusinessDate(businessDate);
  const cashHandovers = await prisma.cashHandover.findMany({
    where: { 
      propertyId, 
      handedOverAt: { gte: businessDate, lt: nextBusinessDate },
      status: 'PENDING'
    },
    include: { handedOverBy: true }
  });

  const bankDeposits = await prisma.bankDeposit.findMany({
    where: {
      propertyId,
      status: { notIn: ['RECONCILED', 'DEPOSITED'] },
      OR: [
        { depositDate: { gte: businessDate, lt: nextBusinessDate } },
        { depositDate: null, createdAt: { gte: businessDate, lt: nextBusinessDate } },
      ],
    }
  });

  return { cashHandovers, bankDeposits, tolerance: property.cashVarianceNightAuditTolerance };
}

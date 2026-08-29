import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';

export async function getOperationalReview(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');
  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());

  const arrivals = await prisma.reservation.findMany({
    where: { propertyId, checkIn: businessDate },
    select: { id: true, status: true, guestId: true, guest: { select: { firstName: true, lastName: true } } }
  });

  const departures = await prisma.reservation.findMany({
    where: { propertyId, checkOut: businessDate },
    select: { id: true, status: true, guestId: true, guest: { select: { firstName: true, lastName: true } }, folios: { select: { balance: true } } }
  });

  const rooms = await prisma.room.findMany({
    where: { propertyId },
    select: { id: true, number: true, status: true, housekeepingStatus: true }
  });

  const roomReconciliation = rooms.map(room => {
    let expected = 'VACANT';
    if (room.status === 'OCCUPIED') expected = 'OCCUPIED';
    if (room.status === 'OUT_OF_ORDER') expected = 'OOO';
    
    let issue = false;
    if (room.status === 'OCCUPIED' && room.housekeepingStatus === 'VACANT') issue = true;
    if (room.status === 'VACANT' && room.housekeepingStatus === 'OCCUPIED') issue = true;

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
    select: { id: true, posOutletId: true, posOutlet: { select: { name: true } }, status: true, openedAt: true }
  });

  const syncConflicts = await prisma.syncConflict.findMany({
    where: { propertyId, status: 'PENDING' }
  });
  
  const financialSyncConflicts = syncConflicts.filter(c => {
    const et = c.hotelEvent?.eventType?.toUpperCase() || '';
    return et.includes('PAYMENT') || et.includes('CHARGE') || et.includes('REFUND') || c.aggregateType === 'FOLIO';
  });

  const hardwareAgents = await prisma.hardwareAgent.findMany({
    where: { propertyId },
    select: { id: true, name: true, status: true, lastSeen: true }
  });

  return { openPosSessions, syncConflicts, financialSyncConflicts, hardwareAgents };
}

export async function getFinancialAudit(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');
  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());

  const openFolios = await prisma.folio.findMany({
    where: { propertyId, status: 'OPEN', balance: { not: 0 } },
    select: { id: true, balance: true, creditLimit: true, reservationId: true, reservation: { select: { guest: { select: { firstName: true, lastName: true } } } } }
  });

  const highBalances = openFolios.filter(f => f.balance > (f.creditLimit || 0));

  const roomCharges = await prisma.folioItem.findMany({
    where: { 
      folio: { propertyId }, 
      type: 'CHARGE', 
      source: 'ROOM', 
      businessDate 
    },
    include: { 
      folio: { 
        select: { 
          reservationId: true, 
          reservation: { 
            select: { 
              guest: { select: { firstName: true, lastName: true } } 
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
  
  const cashHandovers = await prisma.cashHandover.findMany({
    where: { 
      propertyId, 
      handedOverAt: { gte: property.businessDate || new Date() } 
    },
    include: { handedOverBy: true }
  });

  const bankDeposits = await prisma.bankDeposit.findMany({
    where: { propertyId, status: { notIn: ['RECONCILED', 'DEPOSITED'] } }
  }); // Using simplified includes for now due to Staff relation limits

  return { cashHandovers, bankDeposits, tolerance: property.cashVarianceNightAuditTolerance };
}

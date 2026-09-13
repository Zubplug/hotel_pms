'use server';

import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function getNightAuditHistory(propertyId: string) {
  if (!propertyId) return [];
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  const { requireOrganizationContext } = await import('@/lib/organization-access');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  
  const audits = await prisma.nightAudit.findMany({
    where: { propertyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      financialSnapshot: true,
      closePackage: {
        include: {
          accountBalances: true,
        },
      },
      acknowledgements: {
        orderBy: { acknowledgedAt: 'desc' },
      },
    }
  });

  const roomRevenueByAudit = audits.length > 0
    ? await prisma.folioItem.groupBy({
        by: ['nightAuditRunId'],
        where: {
          folio: { propertyId },
          nightAuditRunId: { in: audits.map((audit) => audit.id) },
          type: 'CHARGE',
          source: 'ROOM_CHARGE',
          voidedAt: null,
        },
        _sum: { amount: true },
      })
    : [];
  const roomRevenueMap = new Map(roomRevenueByAudit.map((row) => [row.nightAuditRunId, Number(row._sum.amount || 0)]));

  const userIds = [...new Set(audits.map(a => a.runBy).filter(Boolean))];
  
  const users = await prisma.user.findMany({
    where: { id: { in: userIds as string[] } },
    select: { id: true, staffId: true, email: true }
  });
  
  const staffIds = [...new Set(users.map(u => u.staffId).filter(Boolean))];
  
  const staffs = await prisma.staff.findMany({
    where: { id: { in: staffIds as string[] } },
    select: { id: true, firstName: true, lastName: true }
  });

  const nameMap = new Map();
  for (const user of users) {
    if (user.staffId) {
      const staff = staffs.find(s => s.id === user.staffId);
      if (staff) {
        nameMap.set(user.id, `${staff.firstName} ${staff.lastName}`);
      }
    } else {
      nameMap.set(user.id, user.email.split('@')[0]);
    }
  }

  return audits.map(audit => ({
    ...audit,
    occupancy: Number(audit.occupancy || 0),
    adr: Number(audit.adr || 0),
    revpar: Number(audit.revpar || 0),
    financialSnapshot: audit.financialSnapshot && roomRevenueMap.has(audit.id)
      ? { ...audit.financialSnapshot, roomRevenue: roomRevenueMap.get(audit.id) }
      : audit.financialSnapshot,
    auditorName: audit.runBy ? nameMap.get(audit.runBy) || 'Unknown User' : 'SYSTEM',
  }));
}

export async function getSystemHealth(propertyId: string) {
  if (!propertyId) return null;
  const hardware = await prisma.hardwareAgent.findMany({
    where: { propertyId }
  });
  const syncConflicts = await prisma.syncConflict.count({
    where: { propertyId, status: 'PENDING' }
  });
  
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  
  const posOrdersOpen = await prisma.posOrder.count({
    where: { 
      propertyId, 
      status: { in: ['SUBMITTED', 'IN_SERVICE'] },
      businessDate: property?.businessDate || new Date()
    }
  });

  const outboxPending = await prisma.outboxEvent.count({
    where: { propertyId, status: 'PENDING' }
  });

  const outboxFailed = await prisma.outboxEvent.count({
    where: { propertyId, status: 'FAILED' }
  });

  const integrationErrors = await prisma.webhookEvent.count({
    where: { status: 'failed' } // webhook events might not have propertyId easily accessible
  });

  const retryStatus = await prisma.outboxEvent.count({
    where: { propertyId, status: 'PENDING', attemptCount: { gt: 0 } }
  });

  const lastSyncResult = await prisma.outboxEvent.findFirst({
    where: { propertyId, status: 'COMPLETED' },
    orderBy: { processedAt: 'desc' },
    select: { processedAt: true }
  });
  
  return { 
    hardware, 
    syncConflicts,
    posOrdersOpen,
    outboxPending,
    outboxFailed,
    integrationErrors,
    retryStatus,
    lastSync: lastSyncResult?.processedAt || null
  };
}

export async function getNightAuditRoomCharges(propertyId: string, auditId: string) {
  if (!propertyId || !auditId) return [];
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  const { requireOrganizationContext } = await import('@/lib/organization-access');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');

  const charges = await prisma.folioItem.findMany({
    where: {
      folio: { propertyId },
      nightAuditRunId: auditId,
      voidedAt: null,
    },
    include: {
      folio: {
        include: {
          reservation: {
            include: {
              reservationRooms: {
                include: { room: true }
              },
              primaryGuest: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Corporate room charges are posted to a shared CITY_LEDGER folio, so that
  // folio cannot carry the individual reservation/guest relationship. The
  // night-audit poster stores the reservation in the operation id instead.
  const reservationIds = Array.from(new Set(
    charges
      .map((charge) => charge.operationId?.match(/^ROOM_CHARGE_([0-9a-f-]{36})_/i)?.[1])
      .filter((id): id is string => Boolean(id)),
  ));

  const reservations = reservationIds.length > 0
    ? await prisma.reservation.findMany({
        where: { propertyId, id: { in: reservationIds } },
        include: {
          reservationRooms: {
            where: { status: 'ACTIVE' },
            include: { room: true },
          },
          primaryGuest: true,
        },
      })
    : [];
  const reservationById = new Map(reservations.map((reservation) => [reservation.id, reservation]));

  return charges.map(charge => {
    const operationReservationId = charge.operationId?.match(/^ROOM_CHARGE_([0-9a-f-]{36})_/i)?.[1];
    const res = charge.folio?.reservation ||
      (operationReservationId ? reservationById.get(operationReservationId) : undefined);
    const roomNumber = res?.reservationRooms?.[0]?.room?.number || 'Unassigned';
    const guestName = res?.primaryGuest ? `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}` : 'Unknown Guest';
    
    return {
      id: charge.id,
      amount: Number(charge.amount),
      description: charge.description,
      roomNumber,
      guestName,
      reservationId: res?.id,
    };
  });
}

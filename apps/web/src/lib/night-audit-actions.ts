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

export async function getRoomAndGuestControl(propertyId: string): Promise<any> {
  if (!propertyId) throw new Error('Property ID required');
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property) throw new Error('Property not found');
  
  const businessDate = property.businessDate || new Date();
  const businessDateStr = businessDate.toISOString().split('T')[0];

  const pendingArrivals = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: { in: ['CONFIRMED', 'PENDING', 'INQUIRY'] },
      checkIn: { lte: businessDate }
    },
    include: {
      primaryGuest: true,
      reservationRooms: { include: { room: true } }
    }
  });

  const pendingDepartures = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: 'CHECKED_IN',
      checkOut: { lte: businessDate }
    },
    include: {
      primaryGuest: true,
      reservationRooms: { include: { room: true } },
      folios: { where: { type: 'ROOM' } }
    }
  });

  const noShows = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: 'NO_SHOW',
      checkIn: { lte: businessDate },
    },
    include: {
      primaryGuest: true,
      reservationRooms: { include: { room: true } }
    }
  });

  const inHouseReservations = await prisma.reservation.findMany({
    where: { propertyId, status: 'CHECKED_IN' },
    include: {
      primaryGuest: true,
      reservationRooms: { include: { room: true } },
      folios: {
        where: { type: 'ROOM' },
        include: {
          items: {
            where: {
              source: 'ROOM_CHARGE',
              businessDate: businessDate
            }
          }
        }
      },
      corporateAccount: true
    }
  });

  let inHouseGuestCount = 0;
  let missingRoomCharges = [];
  let folioBalanceExceptions = [];
  let creditLimitExceptions = [];
  
  const unassignedArrivals = pendingArrivals.filter(r => r.reservationRooms.length === 0 || r.reservationRooms.every(rr => !rr.roomId));

  for (const res of inHouseReservations) {
    inHouseGuestCount += (res.adults || 0) + (res.children || 0);

    const primaryFolio = res.folios[0];
    if (primaryFolio) {
      if (res.checkOut.getTime() !== businessDate.getTime()) {
        const hasRoomCharge = primaryFolio.items.length > 0;
        if (!hasRoomCharge && !res.corporateAccountId) {
           missingRoomCharges.push(res);
        }
      }

      if (Number(primaryFolio.balance) > 0 && res.checkOut.getTime() <= businessDate.getTime()) {
        folioBalanceExceptions.push(res);
      }

      const creditLimit = Number(res.corporateAccount?.creditLimit || 0);
      if (creditLimit > 0 && Number(primaryFolio.balance) > creditLimit) {
        creditLimitExceptions.push(res);
      }
    }
  }
  
  if (inHouseReservations.some(r => r.corporateAccountId)) {
     const corporateRes = inHouseReservations.filter(r => r.corporateAccountId);
     const corporateChargeKeys = corporateRes.map(r => `ROOM_CHARGE_${r.id}_${businessDateStr}`);
     const existingCorporateCharges = await prisma.folioItem.findMany({
       where: { folio: { propertyId }, operationId: { in: corporateChargeKeys } },
       select: { operationId: true }
     });
     const foundKeys = new Set(existingCorporateCharges.map(c => c.operationId));
     for (const r of corporateRes) {
       if (r.checkOut.getTime() > businessDate.getTime() && !foundKeys.has(`ROOM_CHARGE_${r.id}_${businessDateStr}`)) {
         missingRoomCharges.push(r);
       }
     }
  }

  const allRooms = await prisma.room.findMany({
    where: { propertyId },
    include: {
      reservationRooms: {
        where: { status: 'ACTIVE', reservation: { status: 'CHECKED_IN' } },
        include: { reservation: true }
      },
      roomType: true
    }
  });

  let roomStatusMismatches = [];
  let assignmentIntegrity = [];

  for (const room of allRooms) {
    const activeResRooms = room.reservationRooms.filter(rr => rr.status === 'ACTIVE' && rr.reservation.status === 'CHECKED_IN');
    const hasActiveCheckedIn = activeResRooms.length > 0;
    
    if (room.status === 'OCCUPIED' && !hasActiveCheckedIn) {
      roomStatusMismatches.push({ room, type: 'OCCUPIED_NO_GUEST', reason: 'Room is OCCUPIED but has no checked-in reservation.' });
    } else if (room.status === 'AVAILABLE' && hasActiveCheckedIn) {
      roomStatusMismatches.push({ room, type: 'AVAILABLE_WITH_GUEST', reason: 'Room is AVAILABLE but has a checked-in guest.' });
    }

    if (activeResRooms.length > 1) {
      assignmentIntegrity.push({
        room,
        type: 'MULTIPLE_GUESTS',
        reason: 'Multiple checked-in reservations are assigned to this room.',
        reservations: activeResRooms.map(rr => rr.reservation)
      });
    }

    // Stale assignments check
    const staleResRooms = room.reservationRooms.filter(rr => rr.status === 'ACTIVE' && ['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'].includes(rr.reservation.status));
    if (staleResRooms.length > 0) {
      assignmentIntegrity.push({
        room,
        type: 'STALE_ASSIGNMENT',
        reason: 'Room has an active assignment for a cancelled, no-show, or checked-out reservation.',
        reservations: staleResRooms.map(rr => rr.reservation)
      });
    }
  }

  // Active checked-in without room assignment
  for (const res of inHouseReservations) {
    if (res.reservationRooms.length === 0 || res.reservationRooms.every(rr => !rr.roomId)) {
      assignmentIntegrity.push({
        type: 'CHECKED_IN_NO_ROOM',
        reason: 'Guest is checked in but has no room assigned.',
        reservations: [res]
      });
    }
  }

  // Unbalanced folios check
  let unbalancedFolios = [];
  for (const res of inHouseReservations) {
    const primaryFolio = res.folios[0];
    if (primaryFolio) {
      const balance = Number(primaryFolio.balance || 0);
      if (balance < 0) {
        unbalancedFolios.push({
          reservation: res,
          type: 'NEGATIVE_BALANCE',
          reason: 'Folio has a negative balance (payments exceed charges).'
        });
      }
    }
  }

  return {
    businessDate,
    pendingArrivals,
    pendingDepartures,
    noShows,
    unassignedArrivals,
    inHouseGuestCount,
    inHouseReservationCount: inHouseReservations.length,
    missingRoomCharges,
    folioBalanceExceptions,
    creditLimitExceptions,
    roomStatusMismatches,
    assignmentIntegrity,
    unbalancedFolios,
  };
}

export async function getAccountsReceivable(propertyId: string) {
  if (!propertyId) return [];
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  const { requireOrganizationContext } = await import('@/lib/organization-access');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  
  const folios = await prisma.folio.findMany({
    where: { 
      propertyId,
      balance: { gt: 0 },
      status: { not: 'VOID' }
    },
    include: {
      guest: true,
      reservation: {
        include: {
          reservationRooms: {
            include: { room: true }
          }
        }
      },
      corporateAccount: true
    },
    orderBy: { balance: 'desc' }
  });
  return folios;
}

export async function getAccountsPayable(propertyId: string) {
  if (!propertyId) return { negativeFolios: [], credits: [] };
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHORIZED');
  const { requireOrganizationContext } = await import('@/lib/organization-access');
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  
  const negativeFolios = await prisma.folio.findMany({
    where: { 
      propertyId,
      balance: { lt: 0 },
      status: { not: 'VOID' }
    },
    include: {
      guest: true,
      reservation: {
        include: {
          reservationRooms: {
            include: { room: true }
          }
        }
      },
      corporateAccount: true
    },
    orderBy: { balance: 'asc' } // Most negative first
  });

  const [credits, corporateAdvanceEntries] = await Promise.all([
    prisma.folioCredit.findMany({
    where: {
      propertyId,
      remainingAmount: { gt: 0 },
      status: { notIn: ['EXHAUSTED', 'REFUNDED'] }
    },
    include: {
      folio: {
        include: {
          guest: true,
          corporateAccount: true
        }
      },
      reservation: true
    },
    orderBy: { remainingAmount: 'desc' }
    }),
    prisma.cityLedgerEntry.findMany({
      where: {
        propertyId,
        type: 'PAYMENT',
        status: 'OPEN',
        account: { type: 'CORPORATE' },
      },
      include: {
        account: { select: { id: true, name: true, currency: true } },
        allocations: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const corporateAdvances = corporateAdvanceEntries
    .map((entry) => ({
      ...entry,
      kind: 'CITY_LEDGER_ADVANCE',
      remainingAmount: Number(entry.amount) - entry.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0),
    }))
    .filter((entry) => entry.remainingAmount > 0.01);

  return { negativeFolios, credits, corporateAdvances };
}

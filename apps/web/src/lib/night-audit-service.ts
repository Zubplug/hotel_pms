import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate, getNextBusinessDate } from '@/lib/date-utils';
import crypto from 'crypto';
import { TenantContext } from './organization-access';

export async function getOperationalReview(ctx: TenantContext, propertyId: string) {
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
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
    },
    select: { roomId: true, reservation: { select: { status: true } } },
  });
  const expectedByRoom = new Map(activeRoomReservations.map((reservationRoom) => [reservationRoom.roomId!, reservationRoom.reservation.status]));

  const roomReconciliation = rooms.map(room => {
    const reservationStatus = expectedByRoom.get(room.id);
    const expected = room.status === 'OUT_OF_ORDER'
      ? 'OOO'
      : reservationStatus === 'CHECKED_IN' ? 'OCCUPIED' : reservationStatus === 'CONFIRMED' ? 'RESERVED' : 'AVAILABLE';
    
    // We only care about PMS status mismatch vs Reservation status for discrepancies.
    // Housekeeping status (e.g. INSPECTED while OCCUPIED) is operationally valid and shouldn't block audit.
    const pmsMismatch = expected !== 'OOO' && room.status !== expected && !(expected === 'AVAILABLE' && room.status === 'RESERVED');
    const issue = pmsMismatch;

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

export async function getSystemIntegrity(ctx: TenantContext, propertyId: string) {
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error('NOT_FOUND:Property not found');
  const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone, new Date());

  const rawPosSessions = await prisma.posSession.findMany({
    where: { propertyId, businessDate, status: { in: ['OPEN', 'RECONCILIATION_REQUIRED'] } },
    select: {
      id: true,
      outletId: true,
      outlet: { select: { name: true } },
      status: true,
      openedAt: true,
      expectedCash: true,
      actualCash: true,
      openingCash: true,
      payments: {
        where: { method: 'CASH', status: { in: ['CONFIRMED', 'PAID'] } },
        select: { amount: true },
      },
      cashMovements: {
        select: { type: true, amount: true },
      },
    }
  });

  const processedPosSessions = rawPosSessions.map(session => {
    const cashSales = session.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const movementTotal = (types: string[]) => session.cashMovements.filter((m: any) => types.includes(m.type)).reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0);
    const calculatedExpectedCash = Number(session.openingCash || 0) + cashSales 
      + movementTotal(['CASH_IN', 'CASH_TRANSFER_IN']) 
      - movementTotal(['CASH_DROP', 'PAID_OUT', 'CASH_TRANSFER_OUT']) 
      - movementTotal(['REFUND', 'REFUND_CASH']);
      
    // Use the calculated value if the session is OPEN (where DB expectedCash might be 0/null), otherwise prefer the DB value.
    const expectedCash = session.status === 'OPEN' ? calculatedExpectedCash : Number(session.expectedCash ?? calculatedExpectedCash);
    const { payments, cashMovements, openingCash, ...rest } = session;
    return { ...rest, expectedCash };
  });

  // SERVER-banking sessions that are RECONCILIATION_REQUIRED have already been submitted
  // by the waiter. The physical cash handover is handled separately. They should not
  // block the System Control step, as the auditor cannot bypass them from this screen.
  const openPosSessions = processedPosSessions.filter(s => s.status === 'OPEN');

  const rawFrontdeskSessions = await prisma.frontdeskSession.findMany({
    where: { propertyId, businessDate, status: { in: ['OPEN', 'CLOSING'] }, controlStatus: 'OPEN' },
    select: {
      id: true,
      shiftReference: true,
      status: true,
      controlStatus: true,
      openedAt: true,
      openingFloat: true,
      systemExpectedCash: true,
      staff: { select: { firstName: true, lastName: true } },
      payments: {
        where: { method: 'CASH', status: { in: ['COMPLETED', 'POSTED', 'SETTLED'] } },
        select: { amount: true }
      }
    },
  });

  const openFrontdeskSessions = rawFrontdeskSessions.map(session => {
    const cashReceipts = session.payments.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
    const expectedCash = Number(session.openingFloat || 0) + cashReceipts;
    const { payments, ...rest } = session;
    return {
      ...rest,
      expectedCash // Inject dynamically calculated expected cash
    };
  });

  const syncConflicts = await prisma.syncConflict.findMany({
    where: { propertyId, status: 'PENDING' },
    include: { hotelEvent: true }
  });
  
  const financialSyncConflicts = syncConflicts.filter(c => {
    const et = c.hotelEvent?.eventType?.toUpperCase() || '';
    return et.includes('PAYMENT') || et.includes('CHARGE') || et.includes('REFUND') || c.aggregateType === 'FOLIO';
  });

  // Open POS orders — waiters must settle or void these before the day can close.
  // This is read-only from the auditor's perspective; they notify the waiter.
  const rawOpenPosOrders = await prisma.posOrder.findMany({
    where: {
      outlet: { propertyId },
      businessDate,
      paymentStatus: { not: 'PAID' },
      status: { notIn: ['VOIDED', 'CLOSED'] },
    },
    select: {
      id: true,
      orderNumber: true,
      displayName: true,
      tableNumber: true,
      orderType: true,
      status: true,
      paymentStatus: true,
      total: true,
      createdAt: true,
      session: { select: { id: true } },
      serverStaff: { select: { firstName: true, lastName: true } },
      outlet: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const openPosOrders = rawOpenPosOrders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    displayName: o.displayName,
    tableNumber: o.tableNumber,
    orderType: o.orderType,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: Number(o.total),
    outletName: o.outlet?.name ?? 'Unknown Outlet',
    waiterName: o.serverStaff
      ? `${o.serverStaff.firstName} ${o.serverStaff.lastName}`.trim()
      : 'Unknown',
    sessionId: o.session?.id ?? null,
    createdAt: o.createdAt,
  }));

  return { openPosSessions, openFrontdeskSessions, syncConflicts, financialSyncConflicts, openPosOrders };
}

export async function getFinancialAudit(ctx: TenantContext, propertyId: string) {
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
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

  // Fetch pending discount approvals for checked-in reservations
  // so the Night Auditor can review and approve them before running the audit
  const pendingDiscounts = await prisma.approvalRequest.findMany({
    where: {
      propertyId,
      type: 'DISCOUNT',
      status: 'PENDING',
    },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      requestedAt: true,
      details: true,
      snapshot: true,
      amount: true,
      currency: true,
      requestedBy: true,
      reviewedBy: true,
      reviewedAt: true,
    }
  });

  // ApprovalRequest intentionally stores staff IDs and an immutable JSON
  // snapshot rather than hard relations. Resolve those IDs here so the audit
  // screen shows accountable names and the actual reservation context.
  const approvalSnapshot = (approval: typeof pendingDiscounts[number]) => {
    const details = (approval.details && typeof approval.details === 'object' ? approval.details : {}) as Record<string, any>;
    const snapshot = (approval.snapshot && typeof approval.snapshot === 'object' ? approval.snapshot : {}) as Record<string, any>;
    return { details, snapshot };
  };
  const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const reservationRoomIds = pendingDiscounts
    .map((approval) => {
      const { details, snapshot } = approvalSnapshot(approval);
      return snapshot.reservationRoomId || details.reservationRoomId;
    })
    .filter(isUuid);
  const approvalRooms = await prisma.reservationRoom.findMany({
    where: { id: { in: reservationRoomIds }, reservation: { propertyId } },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      rateAmount: true,
      currency: true,
      discountType: true,
      discountAmount: true,
      discountPercent: true,
      discountReason: true,
      room: { select: { number: true, roomType: { select: { name: true } } } },
      reservation: {
        select: {
          confirmationNumber: true,
          primaryGuest: { select: { firstName: true, lastName: true } },
          corporateAccount: { select: { name: true, code: true } },
        },
      },
    },
  });
  const approvalRoomById = new Map(approvalRooms.map((room) => [room.id, room]));
  const staffIds = Array.from(new Set(pendingDiscounts.flatMap((approval) => {
    const { details, snapshot } = approvalSnapshot(approval);
    return [approval.requestedBy, approval.reviewedBy, details.acknowledgedBy, details.acknowledgedById, details.acknowledgedByStaffId, snapshot.acknowledgedBy, snapshot.acknowledgedById, snapshot.acknowledgedByStaffId]
      .filter(isUuid);
  })));
  const approvalStaff = await prisma.staff.findMany({
    where: { id: { in: staffIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const staffById = new Map(approvalStaff.map((staff) => [staff.id, staff]));
  const staffName = (id: string | null | undefined) => {
    if (!id) return null;
    const staff = staffById.get(id);
    return staff ? `${staff.firstName} ${staff.lastName}`.trim() : null;
  };
  const enrichedPendingDiscounts = pendingDiscounts.map((approval) => {
    const { details, snapshot } = approvalSnapshot(approval);
    const reservationRoomId = snapshot.reservationRoomId || details.reservationRoomId;
    const room = typeof reservationRoomId === 'string' ? approvalRoomById.get(reservationRoomId) : undefined;
    const acknowledgedById = details.acknowledgedBy || details.acknowledgedById || details.acknowledgedByStaffId || snapshot.acknowledgedBy || snapshot.acknowledgedById || snapshot.acknowledgedByStaffId;
    return {
      ...approval,
      requester: staffById.get(approval.requestedBy) || null,
      requestedByName: staffName(approval.requestedBy) || approval.requestedBy,
      acknowledgedByName: staffName(acknowledgedById) || (typeof acknowledgedById === 'string' ? acknowledgedById : null),
      reservationRoomId,
      reservationRoom: room || null,
      roomStatus: room ? 'READY' : 'WAITING_FOR_RESERVATION_ROOM',
    };
  }).filter((approval) => approval.roomStatus === 'READY');

  // Fetch unverified Complimentary transactions for the business date
  // These are hard blockers for the Night Audit.
  const unverifiedComplimentary = await prisma.complimentaryRecord.findMany({
    where: {
      propertyId,
      businessDate,
      status: { in: ['PENDING_NIGHT_AUDIT', 'UNRESOLVED'] }
    },
    include: {
      operator: { select: { firstName: true, lastName: true } },
      approver: { select: { firstName: true, lastName: true } },
      staff: { select: { firstName: true, lastName: true } }
    }
  });

  const complimentaryRoomIds = unverifiedComplimentary
    .map((record) => record.roomId)
    .filter((id): id is string => Boolean(id));
  const complimentaryRooms = await prisma.reservationRoom.findMany({
    where: { roomId: { in: complimentaryRoomIds }, reservation: { propertyId } },
    orderBy: { createdAt: 'desc' },
    select: {
      roomId: true,
      checkIn: true,
      checkOut: true,
      room: { select: { number: true, roomType: { select: { name: true } } } },
      reservation: {
        select: {
          confirmationNumber: true,
          primaryGuest: { select: { firstName: true, lastName: true } },
          corporateAccount: { select: { name: true, code: true } },
        },
      },
    },
  });
  const complimentaryRoomById = new Map<string, typeof complimentaryRooms[number]>();
  for (const room of complimentaryRooms) {
    if (room.roomId && !complimentaryRoomById.has(room.roomId)) complimentaryRoomById.set(room.roomId, room);
  }
  const complimentaryAcknowledgers = await prisma.staff.findMany({
    where: {
      id: {
        in: unverifiedComplimentary.flatMap((record) => {
          if (!record.notes) return [];
          try {
            const notes = JSON.parse(record.notes) as Record<string, unknown>;
            return typeof notes.acknowledgedByStaffId === 'string' ? [notes.acknowledgedByStaffId] : [];
          } catch { return []; }
        }),
      },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  const complimentaryAcknowledgersById = new Map(complimentaryAcknowledgers.map((staff) => [staff.id, staff]));
  const enrichedComplimentary = unverifiedComplimentary.map((record) => {
    let acknowledgedByStaffId: string | null = null;
    if (record.notes) {
      try { acknowledgedByStaffId = (JSON.parse(record.notes) as Record<string, unknown>).acknowledgedByStaffId as string || null; } catch { /* legacy notes */ }
    }
    const acknowledgedBy = record.approver || (acknowledgedByStaffId ? complimentaryAcknowledgersById.get(acknowledgedByStaffId) : null);
    return {
      ...record,
      reservationRoom: record.roomId ? complimentaryRoomById.get(record.roomId) || null : null,
      requestedByName: record.operator ? `${record.operator.firstName} ${record.operator.lastName}`.trim() : record.operatorId,
      acknowledgedByName: acknowledgedBy ? `${acknowledgedBy.firstName} ${acknowledgedBy.lastName}`.trim() : acknowledgedByStaffId,
    };
  });

  // Fetch unverified Check-In Bypasses
  // These represent unresolved financial exceptions where check-in occurred without deposit.
  const pendingCheckInBypasses = await prisma.checkInBypass.findMany({
    where: {
      propertyId,
      status: { in: ['PENDING', 'REJECTED'] }
    },
    include: {
      operator: { select: { firstName: true, lastName: true } },
      acknowledgedBy: { select: { firstName: true, lastName: true } },
      reservation: { select: { confirmationNumber: true, primaryGuest: { select: { firstName: true, lastName: true } }, folios: { select: { balance: true } } } }
    }
  });

  return { openFolios, highBalances, rateVariances, pendingDiscounts: enrichedPendingDiscounts, unverifiedComplimentary: enrichedComplimentary, pendingCheckInBypasses };
}

export async function getCashReconciliation(ctx: TenantContext, propertyId: string) {
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
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

  const unverifiedPayments = await prisma.payment.findMany({
    where: {
      propertyId,
      method: { in: ['BANK_TRANSFER', 'POS'] },
      verificationStatus: 'UNVERIFIED',
      createdAt: { gte: businessDate, lt: nextBusinessDate }
    },
    include: {
      folio: {
        select: {
          folioNumber: true,
          reservation: {
            select: {
              primaryGuest: { select: { firstName: true, lastName: true } }
            }
          }
        }
      },
      frontdeskSession: {
        select: {
          shiftReference: true,
          staff: { select: { firstName: true, lastName: true } }
        }
      }
    }
  });

  const unverifiedPosPayments = await prisma.posPayment.findMany({
    where: {
      method: { in: ['BANK_TRANSFER', 'POS'] },
      verificationStatus: 'UNVERIFIED',
      businessDate: businessDate,
      order: { outlet: { propertyId } }
    },
    include: {
      order: {
        select: {
          id: true,
          outlet: { select: { name: true } }
        }
      },
      session: {
        select: {
          id: true
        }
      }
    }
  });

  return { 
    cashHandovers, 
    bankDeposits, 
    unverifiedTransactions: [...unverifiedPayments, ...unverifiedPosPayments],
    tolerance: property.cashVarianceNightAuditTolerance 
  };
}

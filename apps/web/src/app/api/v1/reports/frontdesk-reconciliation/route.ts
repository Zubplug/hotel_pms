import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';

const toNumber = (value: unknown) => Number(value ?? 0);

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!propertyId || !startDate || !endDate) {
      return errorResponse('BAD_REQUEST', 'propertyId, startDate, and endDate are required', 400);
    }

    const allowedProperties = await getUserPropertyIds(session.user.id);
    if (!allowedProperties.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return errorResponse('BAD_REQUEST', 'Invalid report date range', 400);
    }

    const sessions = await prisma.frontdeskSession.findMany({
      where: { propertyId, businessDate: { gte: start, lte: end } },
      orderBy: [{ businessDate: 'desc' }, { openedAt: 'desc' }],
      include: {
        staff: { select: { id: true, firstName: true, lastName: true, role: true } },
        cashAccount: { select: { id: true, name: true, type: true } },
        exceptions: { orderBy: { createdAt: 'desc' } },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            folio: {
              include: {
                reservation: {
                  select: {
                    id: true,
                    confirmationNumber: true,
                    checkIn: true,
                    checkOut: true,
                    reservationRooms: { include: { room: { select: { number: true, displayName: true } } } },
                  },
                },
                guest: { select: { firstName: true, lastName: true } },
                items: { orderBy: { createdAt: 'asc' } },
              },
            },
          },
        },
        cashMovements: { orderBy: { createdAt: 'desc' } },
      },
    });

    const reportSessions = sessions.map((frontdeskSession) => {
      const payments = frontdeskSession.payments.map((payment) => ({
        id: payment.id,
        kind: 'PAYMENT',
        date: payment.createdAt,
        businessDate: frontdeskSession.businessDate,
        direction: 'INFLOW',
        amount: toNumber(payment.amount),
        currency: payment.currency,
        method: payment.method,
        type: 'PAYMENT',
        description: payment.notes || `Folio payment ${payment.folio.folioNumber}`,
        staffId: payment.receivedBy,
        reference: payment.reference || payment.receiptNumber || payment.providerRef,
        terminalId: payment.terminalId,
        reservationId: payment.reservationId || payment.folio.reservationId,
        confirmationNumber: payment.folio.reservation?.confirmationNumber,
        folioNumber: payment.folio.folioNumber,
        guest: payment.folio.guest ? `${payment.folio.guest.firstName} ${payment.folio.guest.lastName}` : null,
        rooms: payment.folio.reservation?.reservationRooms.map((room) => room.room?.displayName || room.room?.number).filter(Boolean) || [],
      }));

      const movements = frontdeskSession.cashMovements.map((movement) => {
        const inflow = ['OPENING_FLOAT', 'PAYMENT', 'CASH_TRANSFER_IN'].includes(movement.type);
        return {
          id: movement.id,
          kind: 'CASH_MOVEMENT',
          date: movement.createdAt,
          businessDate: movement.businessDate || frontdeskSession.businessDate,
          direction: inflow ? 'INFLOW' : 'OUTFLOW',
          amount: toNumber(movement.amount),
          currency: movement.currency,
          method: 'CASH',
          type: movement.type,
          description: movement.notes || movement.reasonCode,
          staffId: movement.userId,
          reference: movement.receiptReference || movement.operationId,
          terminalId: null,
          reservationId: null,
          confirmationNumber: null,
          folioNumber: null,
          guest: null,
          rooms: [],
        };
      });

      const charges = frontdeskSession.payments.flatMap((payment) => payment.folio.items.map((item) => {
        const itemAmount = toNumber(item.amount);
        return {
        id: item.id,
        kind: 'FOLIO_CHARGE',
        date: item.createdAt,
        businessDate: item.businessDate,
        direction: itemAmount >= 0 ? 'INFLOW' : 'OUTFLOW',
        amount: itemAmount,
        currency: item.currency,
        method: 'FOLIO',
        type: item.type,
        description: item.description,
        staffId: item.postedBy,
        reference: item.operationId,
        terminalId: null,
        reservationId: payment.reservationId || payment.folio.reservationId,
        confirmationNumber: payment.folio.reservation?.confirmationNumber,
        folioNumber: payment.folio.folioNumber,
        guest: payment.folio.guest ? `${payment.folio.guest.firstName} ${payment.folio.guest.lastName}` : null,
        rooms: payment.folio.reservation?.reservationRooms.map((room) => room.room?.displayName || room.room?.number).filter(Boolean) || [],
        source: item.source,
        quantity: toNumber(item.quantity),
        unitAmount: toNumber(item.unitAmount),
        };
      }));

      const rows = [...payments, ...movements, ...charges].sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
      );

      return {
        id: frontdeskSession.id,
        shiftReference: frontdeskSession.shiftReference,
        businessDate: frontdeskSession.businessDate,
        status: frontdeskSession.status,
        openingFloat: toNumber(frontdeskSession.openingFloat),
        expectedCash: toNumber(frontdeskSession.systemExpectedCash),
        declaredCash: frontdeskSession.declaredCash == null ? null : toNumber(frontdeskSession.declaredCash),
        variance: frontdeskSession.variance == null ? null : toNumber(frontdeskSession.variance),
        openedAt: frontdeskSession.openedAt,
        closedAt: frontdeskSession.closedAt,
        staff: frontdeskSession.staff,
        cashAccount: frontdeskSession.cashAccount,
        exceptions: frontdeskSession.exceptions,
        rows,
      };
    });

    const rows = reportSessions.flatMap((item) => item.rows.map((row) => ({ ...row, sessionId: item.id, shiftReference: item.shiftReference })));
    const inflows = rows.filter((row) => row.direction === 'INFLOW').reduce((sum, row) => sum + row.amount, 0);
    const outflows = rows.filter((row) => row.direction === 'OUTFLOW').reduce((sum, row) => sum + row.amount, 0);

    return successResponse({
      propertyId,
      startDate,
      endDate,
      sessions: reportSessions,
      rows,
      totals: { inflows, outflows, net: inflows - outflows, sessions: reportSessions.length },
    });
  } catch (error) {
    console.error('[Frontdesk Reconciliation Report GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to generate frontdesk reconciliation report', 500);
  }
}

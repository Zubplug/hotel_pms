import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

const number = (value: unknown) => Number(value ?? 0);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
    const { id } = await params;
    const current = await prisma.frontdeskSession.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true, position: true } },
        cashAccount: { select: { id: true, name: true, type: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            folio: {
              include: {
                reservation: {
                  select: {
                    id: true,
                    confirmationNumber: true,
                    reservationRooms: { include: { room: { select: { number: true, displayName: true } } } },
                  },
                },
                guest: { select: { firstName: true, lastName: true } },
                items: true,
              },
            },
          },
        },
        cashMovements: { orderBy: { createdAt: 'desc' } },
        exceptions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!current) return errorResponse('NOT_FOUND', 'Front Desk session not found', 404);
    if (!((await requireOrganizationContext(session.user.id)).propertyIds).includes(current.propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

    const payments = current.payments.filter(payment => ['COMPLETED', 'PARTIALLY_REFUNDED'].includes(payment.status));
    const cash = payments.filter(payment => payment.method === 'CASH').reduce((sum, payment) => sum + number(payment.amount), 0);
    const card = payments.filter(payment => ['CARD', 'CARD_OFFLINE', 'POS'].includes(payment.method)).reduce((sum, payment) => sum + number(payment.amount), 0);
    const bankTransfer = payments.filter(payment => ['BANK_TRANSFER', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT'].includes(payment.method)).reduce((sum, payment) => sum + number(payment.amount), 0);
    const other = payments.filter(payment => !['CASH', 'CARD', 'CARD_OFFLINE', 'POS', 'BANK_TRANSFER', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT'].includes(payment.method)).reduce((sum, payment) => sum + number(payment.amount), 0);
    const movementTotal = (types: string[]) => current.cashMovements.filter(movement => types.includes(movement.type)).reduce((sum, movement) => sum + number(movement.amount), 0);
    const refunds = movementTotal(['REFUND', 'REFUND_CASH']);
    const cashIn = movementTotal(['CASH_IN', 'CASH_TRANSFER_IN']);
    const cashDrops = movementTotal(['CASH_DROP']);
    const paidOuts = movementTotal(['PAID_OUT']);
    const transfersOut = movementTotal(['CASH_TRANSFER_OUT']);
    const expected = number(current.openingFloat) + cash + cashIn - cashDrops - paidOuts - transfersOut - refunds;
    const rows = [...payments.map(payment => ({ date: payment.createdAt, kind: 'PAYMENT', amount: number(payment.amount), method: payment.method, description: payment.notes || `Folio payment ${payment.folio.folioNumber}` })), ...current.cashMovements.map(movement => ({ date: movement.createdAt, kind: 'CASH_MOVEMENT', amount: number(movement.amount), method: 'CASH', description: movement.notes || movement.reasonCode, type: movement.type }))].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    return successResponse({
      session: { shiftReference: current.shiftReference, status: current.status, staffName: `${current.staff.firstName} ${current.staff.lastName}`.trim(), till: current.cashAccount.name, openingFloat: number(current.openingFloat), expectedCash: expected, declaredCash: current.declaredCash == null ? null : number(current.declaredCash), variance: current.variance == null ? (current.declaredCash == null ? null : number(current.declaredCash) - expected) : number(current.variance), openedAt: current.openedAt, closedAt: current.closedAt },
      payments: { count: payments.length, cash, card, bankTransfer, other, total: cash + card + bankTransfer + other },
      charges: { count: 0, room: 0, laundry: 0, other: 0, total: 0 },
      cash: { openingFloat: number(current.openingFloat), cashIn, cashDrops, paidOuts, transfersOut, refunds, expected, declared: current.declaredCash == null ? null : number(current.declaredCash), variance: current.variance == null ? (current.declaredCash == null ? null : number(current.declaredCash) - expected) : number(current.variance) },
      exceptions: { pendingSync: 0, failedSync: 0, reconciliation: current.exceptions.length },
      rows,
    });
  } catch (error) {
    console.error('[Frontdesk session summary GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load front desk shift summary', 500);
  }
}

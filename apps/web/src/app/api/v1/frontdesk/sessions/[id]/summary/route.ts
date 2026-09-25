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
                    primaryGuest: { select: { firstName: true, lastName: true } },
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

    const property = await prisma.property.findUnique({
      where: { id: current.propertyId },
      select: { name: true, address: true, city: true, state: true, phone: true, email: true, baseCurrency: true, businessDate: true },
    });
    const windowEnd = current.closedAt ?? new Date();
    const folioItems = await prisma.folioItem.findMany({
      where: {
        folio: { propertyId: current.propertyId },
        postedBy: current.staffId,
        createdAt: { gte: current.openedAt, lte: windowEnd },
        voidedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        folio: {
          include: {
            reservation: {
              select: {
                confirmationNumber: true,
                primaryGuest: { select: { firstName: true, lastName: true } },
                reservationRooms: { include: { room: { select: { number: true, displayName: true } } } },
              },
            },
          },
        },
      },
    });

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
    const paymentRows = payments.map(payment => {
      const reservation = payment.folio.reservation;
      const guest = reservation?.primaryGuest ? `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}`.trim() : payment.folio.guest ? `${payment.folio.guest.firstName} ${payment.folio.guest.lastName}`.trim() : '—';
      const room = reservation?.reservationRooms?.map(item => item.room?.displayName || item.room?.number).filter(Boolean).join(', ') || '—';
      return { date: payment.createdAt, kind: 'PAYMENT', amount: number(payment.amount), method: payment.method, description: payment.notes || `Payment for ${guest}`, reference: payment.reference || payment.receiptNumber || payment.id, guest, room, confirmationNumber: reservation?.confirmationNumber || '—' };
    });
    const chargeRows = folioItems.map(item => {
      const reservation = item.folio.reservation;
      const guest = reservation?.primaryGuest ? `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}`.trim() : '—';
      const room = reservation?.reservationRooms?.map(entry => entry.room?.displayName || entry.room?.number).filter(Boolean).join(', ') || '—';
      return { date: item.createdAt, kind: 'CHARGE', amount: Math.abs(number(item.amount)), method: item.source, description: item.description, reference: item.operationId || item.id, guest, room, confirmationNumber: reservation?.confirmationNumber || '—', type: item.type, source: item.source };
    });
    const movementRows = current.cashMovements.map(movement => ({ date: movement.createdAt, kind: 'CASH_MOVEMENT', amount: number(movement.amount), method: 'CASH', description: movement.notes || movement.reasonCode, reference: movement.operationId || movement.id, type: movement.type, guest: '—', room: '—', confirmationNumber: '—' }));
    const rows = [...paymentRows, ...chargeRows, ...movementRows].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    const room = folioItems.filter(item => item.source === 'ROOM_CHARGE' || item.source === 'DAY_USE_ROOM_CHARGE').reduce((sum, item) => sum + Math.max(0, number(item.amount)), 0);
    const laundry = folioItems.filter(item => String(item.source).includes('LAUNDRY')).reduce((sum, item) => sum + Math.max(0, number(item.amount)), 0);
    const otherCharges = folioItems.filter(item => item.source !== 'ROOM_CHARGE' && item.source !== 'DAY_USE_ROOM_CHARGE' && !String(item.source).includes('LAUNDRY') && item.type !== 'PAYMENT').reduce((sum, item) => sum + Math.max(0, number(item.amount)), 0);
    return successResponse({
      property,
      session: { shiftReference: current.shiftReference, status: current.status, staffName: `${current.staff.firstName} ${current.staff.lastName}`.trim(), till: current.cashAccount.name, businessDate: current.businessDate, openingFloat: number(current.openingFloat), expectedCash: expected, declaredCash: current.declaredCash == null ? null : number(current.declaredCash), variance: current.variance == null ? (current.declaredCash == null ? null : number(current.declaredCash) - expected) : number(current.variance), openedAt: current.openedAt, closedAt: current.closedAt },
      payments: { count: payments.length, cash, card, bankTransfer, other, total: cash + card + bankTransfer + other },
      charges: { count: folioItems.length, room, laundry, other: otherCharges, total: room + laundry + otherCharges },
      cash: { openingFloat: number(current.openingFloat), cashIn, cashDrops, paidOuts, transfersOut, refunds, expected, declared: current.declaredCash == null ? null : number(current.declaredCash), variance: current.variance == null ? (current.declaredCash == null ? null : number(current.declaredCash) - expected) : number(current.variance) },
      exceptions: { pendingSync: 0, failedSync: 0, reconciliation: current.exceptions.length },
      rows,
    });
  } catch (error) {
    console.error('[Frontdesk session summary GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load front desk shift summary', 500);
  }
}

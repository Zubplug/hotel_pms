import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getUserPropertyIds } from '@/lib/property-access';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

const amount = (value: unknown) => Number(value ?? 0);

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const actor = await auth();
    const operatorToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null;
    const operatorPayload = operatorToken ? await verifyOperatorToken(operatorToken) : null;
    if (!actor?.user && !operatorPayload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sessionId } = await params;
    const body = await request.json();
    const actualCash = amount(body.actualCash);
    if (!Number.isFinite(actualCash) || actualCash < 0) return NextResponse.json({ error: 'Actual cash must be a valid non-negative amount' }, { status: 400 });

    const current = await prisma.posSession.findUnique({ where: { id: sessionId }, include: { cashMovements: true, payments: true } });
    if (!current || !current.propertyId) return NextResponse.json({ error: 'POS session not found' }, { status: 404 });
    if (actor?.user) {
      const allowed = await getUserPropertyIds(actor.user.id);
      if (!allowed.includes(current.propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else if (operatorPayload?.propertyId !== current.propertyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (current.status !== 'OPEN' && current.status !== 'RECONCILIATION_REQUIRED' && current.controlStatus !== 'RETURNED') return NextResponse.json({ error: `Session cannot be settled from ${current.status}` }, { status: 409 });

    const actorStaff = operatorPayload?.staffId
      ? await prisma.staff.findUnique({ where: { id: operatorPayload.staffId }, select: { id: true, position: true } })
      : actor?.user
        ? await prisma.staff.findFirst({ where: { userId: actor.user.id }, select: { id: true, position: true } })
        : null;
    if (!actorStaff) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });
    const privilegedPositions = new Set(['MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'CEO']);
    const isPrivileged = privilegedPositions.has(String(actorStaff.position || '').toUpperCase());
    const sessionOwnerId = current.primaryOperatorId || current.openedBy;
    if (actorStaff.id !== sessionOwnerId && !isPrivileged) {
      return NextResponse.json({ error: 'Only the POS cashier who opened this shift can close and submit it.' }, { status: 403 });
    }

    const cashSales = current.payments.filter(payment => payment.status === 'CONFIRMED' || payment.status === 'PAID').filter(payment => payment.method === 'CASH').reduce((sum, payment) => sum + amount(payment.amount), 0);
    const movementTotal = (types: string[]) => current.cashMovements.filter(movement => types.includes(movement.type)).reduce((sum, movement) => sum + amount(movement.amount), 0);
    const expectedCash = amount(current.openingCash) + cashSales + movementTotal(['CASH_IN', 'CASH_TRANSFER_IN']) - movementTotal(['CASH_DROP', 'PAID_OUT', 'CASH_TRANSFER_OUT']) - movementTotal(['REFUND', 'REFUND_CASH']);
    const variance = actualCash - expectedCash;
    // The operator is taken from the session, never from a client-supplied
    // value. This prevents an offline/client payload from changing the
    // segregation-of-duty identity.
    const operatorId = current.primaryOperatorId || current.openedBy;
    const authorizerId = body.authorizerId || null;
    if (variance !== 0 && !authorizerId) return NextResponse.json({ error: 'A manager authorization is required for a cash variance' }, { status: 422 });
    if (authorizerId && authorizerId === operatorId) return NextResponse.json({ error: 'The operator cannot authorize their own variance' }, { status: 403 });
    if (authorizerId) {
      const authorizer = await prisma.staff.findUnique({ where: { id: authorizerId }, select: { propertyAccess: true, position: true, isActive: true } });
      if (!authorizer?.isActive || !authorizer.propertyAccess.includes(current.propertyId) || !['GENERAL_CASHIER', 'FINANCE_MANAGER', 'MANAGER', 'HOTEL_MANAGER', 'CEO', 'SUPER_ADMIN'].includes(authorizer.position)) {
        return NextResponse.json({ error: 'Invalid variance authorizer or insufficient authority' }, { status: 403 });
      }
    }

    const operationId = request.headers.get('Idempotency-Key') || `online_settlement_${sessionId}_${Date.now()}`;
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.posSettlement.findUnique({ where: { operationId } });
      if (existing) return existing;
      const settlement = await tx.posSettlement.create({
        data: {
          sessionId,
          propertyId: current.propertyId as string,
          outletId: current.outletId,
          deviceId: current.deviceId || 'web-terminal',
          sessionOwnerId: current.primaryOperatorId || current.openedBy,
          operatorId,
          businessDate: current.businessDate,
          expectedCash,
          actualCash,
          variance,
          authorizerId,
          settledAt: new Date(),
          status: current.bankType === 'SERVER' ? 'PENDING_HANDOVER' : 'SETTLED',
          operationId,
        },
      });
      await tx.posSession.update({ where: { id: sessionId }, data: {
        status: current.bankType === 'SERVER' ? 'RECONCILIATION_REQUIRED' : 'CLOSED',
        controlStatus: 'SUBMITTED',
        varianceStatus: variance === 0 ? null : 'OPEN',
        expectedCash,
        actualCash,
        variance,
        submittedBy: operatorId,
        submittedAt: new Date(),
        closedBy: operatorId,
        closedAt: new Date(),
        // An authorizer on settlement records the declaration authorization;
        // it is not a Finance approval and cannot advance controlStatus.
        approvedBy: null,
        approvedAt: null
      } });
      return settlement;
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[POS settle]', error);
    return NextResponse.json({ error: 'Unable to settle POS session' }, { status: 500 });
  }
}

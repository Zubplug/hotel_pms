import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getUserPropertyIds } from '@/lib/property-access';

const amount = (value: unknown) => Number(value ?? 0);

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sessionId } = await params;
    const body = await request.json();
    const actualCash = amount(body.actualCash);
    if (!Number.isFinite(actualCash) || actualCash < 0) return NextResponse.json({ error: 'Actual cash must be a valid non-negative amount' }, { status: 400 });

    const current = await prisma.posSession.findUnique({ where: { id: sessionId }, include: { cashMovements: true, payments: true } });
    if (!current || !current.propertyId) return NextResponse.json({ error: 'POS session not found' }, { status: 404 });
    const allowed = await getUserPropertyIds(actor.user.id);
    if (!allowed.includes(current.propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (current.status !== 'OPEN' && current.status !== 'RECONCILIATION_REQUIRED') return NextResponse.json({ error: `Session cannot be settled from ${current.status}` }, { status: 409 });

    const cashSales = current.payments.filter(payment => payment.status === 'CONFIRMED' || payment.status === 'PAID').filter(payment => payment.method === 'CASH').reduce((sum, payment) => sum + amount(payment.amount), 0);
    const movementTotal = (types: string[]) => current.cashMovements.filter(movement => types.includes(movement.type)).reduce((sum, movement) => sum + amount(movement.amount), 0);
    const expectedCash = amount(current.openingCash) + cashSales + movementTotal(['CASH_IN', 'CASH_TRANSFER_IN']) - movementTotal(['CASH_DROP', 'PAID_OUT', 'CASH_TRANSFER_OUT']) - movementTotal(['REFUND', 'REFUND_CASH']);
    const variance = actualCash - expectedCash;
    const operatorId = body.operatorId || actor.user.staffId || actor.user.id;
    const authorizerId = body.authorizerId || null;
    if (variance !== 0 && !authorizerId) return NextResponse.json({ error: 'A manager authorization is required for a cash variance' }, { status: 422 });
    if (authorizerId && authorizerId === operatorId) return NextResponse.json({ error: 'The operator cannot authorize their own variance' }, { status: 403 });

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
      await tx.posSession.update({ where: { id: sessionId }, data: { status: current.bankType === 'SERVER' ? 'RECONCILIATION_REQUIRED' : 'CLOSED', expectedCash, actualCash, variance, closedBy: operatorId, closedAt: new Date(), approvedBy: authorizerId, approvedAt: authorizerId ? new Date() : null } });
      return settlement;
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[POS settle]', error);
    return NextResponse.json({ error: 'Unable to settle POS session' }, { status: 500 });
  }
}

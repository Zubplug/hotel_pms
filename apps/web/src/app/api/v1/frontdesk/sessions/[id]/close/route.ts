import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { varianceStatusFor } from '@/lib/shift-control';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const { id } = await params;
    const { declaredCash } = await req.json();
    const staff = await prisma.staff.findFirst({ where: { userId: session.user.id } });
    if (!staff) return errorResponse('UNAUTHORIZED', 'Staff not found', 401);
    const current = await prisma.frontdeskSession.findUnique({ where: { id }, include: { cashMovements: true } });
    if (!current) return errorResponse('NOT_FOUND', 'Session not found', 404);
    if (current.status !== 'OPEN') return errorResponse('BAD_REQUEST', `Cannot close session in status ${current.status}`, 400);
    if (current.staffId !== staff.id) return errorResponse('FORBIDDEN', 'You can only close your own session', 403);
    if (['APPROVED', 'APPROVED_WITH_VARIANCE', 'HANDOVER_PENDING', 'HANDED_OVER', 'DEPOSITED', 'RECONCILED'].includes(String(current.controlStatus))) {
      return errorResponse('CONFLICT', 'A financially controlled shift cannot be closed again', 409);
    }
    const expected = Number(current.openingFloat || 0) + current.cashMovements.reduce((total, movement) => {
      const amount = Number(movement.amount);
      return ['PAYMENT', 'CASH_IN', 'CASH_TRANSFER_IN', 'ADJUSTMENT'].includes(movement.type) ? total + amount : ['REFUND', 'PAID_OUT', 'CASH_DROP', 'CASH_TRANSFER_OUT'].includes(movement.type) ? total - amount : total;
    }, 0);
    const declared = declaredCash === undefined ? 0 : Number(declaredCash);
    const variance = declared - expected;
    const closed = await prisma.$transaction(async tx => {
      const updated = await tx.frontdeskSession.update({ where: { id }, data: { status: 'CLOSED', controlStatus: 'SUBMITTED', varianceStatus: varianceStatusFor(variance), submittedAt: new Date(), submittedBy: staff.id, closingAt: new Date(), closedAt: new Date(), declaredCash: declared, systemExpectedCash: expected, variance } });
      await tx.frontdeskSessionAudit.create({ data: { frontdeskSessionId: id, action: 'CLOSED', performedBy: staff.id, notes: `Declared ${declared}; expected ${expected}; variance ${variance}` } });
      await tx.shiftControlAudit.create({ data: { id: crypto.randomUUID(), propertyId: current.propertyId, frontdeskSessionId: id, action: 'SHIFT_SUBMITTED', fromStatus: 'OPEN', toStatus: 'SUBMITTED', performedBy: staff.id, reason: variance === 0 ? null : (variance < 0 ? 'CASH_SHORT' : 'CASH_OVER'), metadata: { expectedCash: expected, declaredCash: declared, variance }, idempotencyKey: `frontdesk_shift_submitted:${id}` } });
      if (variance !== 0) await tx.reconciliationException.create({ data: { propertyId: current.propertyId, frontdeskSessionId: id, type: variance > 0 ? 'CASH_OVER' : 'CASH_SHORT', severity: Math.abs(variance) > 5000 ? 'HIGH' : 'MEDIUM', amount: Math.abs(variance), source: 'CASH_RECONCILIATION', reason: variance > 0 ? 'Cash overage' : 'Cash shortage' } });
      return updated;
    });
    return successResponse({ session: closed });
  } catch (error) {
    console.error('[Frontdesk Sessions Close POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}

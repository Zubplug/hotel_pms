import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const sessionId = params.id;
    const { declaredCash } = await req.json();

    const staff = await prisma.staff.findFirst({ where: { userId: session.user.id } });
    if (!staff) return errorResponse('UNAUTHORIZED', 'Staff not found', 401);

    const frontdeskSession = await prisma.frontdeskSession.findUnique({
      where: { id: sessionId },
      include: { cashMovements: true }
    });

    if (!frontdeskSession) return errorResponse('NOT_FOUND', 'Session not found', 404);
    if (frontdeskSession.status !== 'OPEN') {
      return errorResponse('BAD_REQUEST', `Cannot close session in status ${frontdeskSession.status}`, 400);
    }
    if (frontdeskSession.staffId !== staff.id) {
      return errorResponse('FORBIDDEN', 'You can only close your own session', 403);
    }

    // Calculate ledger-expected cash
    // sum of all cash movements for this session
    // IN (+): OPENING_FLOAT, PAYMENT, CASH_TRANSFER_IN
    // OUT (-): REFUND, PAID_OUT, CASH_DROP, CASH_TRANSFER_OUT
    let expectedCash = 0;
    frontdeskSession.cashMovements.forEach((movement) => {
      const amt = parseFloat(movement.amount.toString());
      if (['OPENING_FLOAT', 'PAYMENT', 'CASH_TRANSFER_IN'].includes(movement.type)) {
        expectedCash += amt;
      } else if (['REFUND', 'PAID_OUT', 'CASH_DROP', 'CASH_TRANSFER_OUT'].includes(movement.type)) {
        expectedCash -= amt;
      } else if (movement.type === 'ADJUSTMENT') {
        // Assume adjustment amounts can be signed (if negative, it reduces expected cash)
        expectedCash += amt;
      }
    });

    const declared = declaredCash !== undefined ? parseFloat(declaredCash) : 0;
    const variance = declared - expectedCash;

    const closedSession = await prisma.$transaction(async (tx) => {
      // 1. Lock the session state
      const updatedSession = await tx.frontdeskSession.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED', // Bypass CLOSING directly to CLOSED for this simple flow
          closedAt: new Date(),
          declaredCash: declared,
          systemExpectedCash: expectedCash,
          variance: variance,
        }
      });

      // 2. Audit Trail
      await tx.frontdeskSessionAudit.create({
        data: {
          frontdeskSessionId: sessionId,
          action: 'CLOSED',
          performedBy: staff.id,
          notes: `Shift closed. Declared: ${declared}, Expected: ${expectedCash}, Variance: ${variance}`
        }
      });

      // 3. Generate Exceptions if variance exists
      if (variance !== 0) {
        await tx.reconciliationException.create({
          data: {
            propertyId: frontdeskSession.propertyId,
            frontdeskSessionId: sessionId,
            severity: Math.abs(variance) > 5000 ? 'HIGH' : 'MEDIUM',
            amount: Math.abs(variance),
            source: 'CASH_VARIANCE',
            reason: variance > 0 ? 'CASH_OVER' : 'CASH_SHORT',
            status: 'OPEN'
          }
        });
      }

      return updatedSession;
    });

    return successResponse({ session: closedSession });
  } catch (err) {
    console.error('[Frontdesk Sessions Close POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}

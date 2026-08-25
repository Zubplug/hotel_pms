import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const sessionId = params.id;
    const { decision, notes } = await req.json();

    if (!['APPROVED', 'APPROVED_WITH_VARIANCE', 'REJECTED'].includes(decision)) {
      return errorResponse('BAD_REQUEST', 'Invalid decision', 400);
    }

    const staff = await prisma.staff.findFirst({
      where: { userId: session.user.id }
    });
    if (!staff) return errorResponse('UNAUTHORIZED', 'Staff not found', 401);

    const frontdeskSession = await prisma.frontdeskSession.findUnique({
      where: { id: sessionId },
      include: { exceptions: true }
    });

    if (!frontdeskSession) return errorResponse('NOT_FOUND', 'Session not found', 404);
    if (!['CLOSED', 'UNDER_REVIEW'].includes(frontdeskSession.status)) {
      return errorResponse('BAD_REQUEST', `Cannot reconcile session in status ${frontdeskSession.status}`, 400);
    }

    // Check if there are outstanding open exceptions
    const openExceptions = frontdeskSession.exceptions.filter(ex => ex.status === 'OPEN');
    if (openExceptions.length > 0 && decision === 'APPROVED') {
      return errorResponse('CONFLICT', 'Cannot approve session with open exceptions. Either resolve them or use APPROVED_WITH_VARIANCE.', 409);
    }

    const nextStatus = decision === 'REJECTED' ? 'UNDER_REVIEW' : 'RECONCILED';

    const updatedSession = await prisma.$transaction(async (tx) => {
      const updated = await tx.frontdeskSession.update({
        where: { id: sessionId },
        data: {
          status: nextStatus,
          reconciledAt: new Date(),
          reconciledBy: staff.id,
          reconciliationDecision: decision,
          reconciliationNotes: notes
        }
      });

      await tx.frontdeskSessionAudit.create({
        data: {
          frontdeskSessionId: sessionId,
          action: nextStatus === 'RECONCILED' ? 'RECONCILED' : 'RECONCILIATION_REVIEWED',
          performedBy: staff.id,
          notes: `Manager decision: ${decision}. Notes: ${notes || ''}`
        }
      });

      return updated;
    });

    return successResponse({ session: updatedSession });
  } catch (err) {
    console.error('[Frontdesk Sessions Reconcile POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}

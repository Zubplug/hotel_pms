import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId, nightAuditId, warningType, reason, comment } = body;

    if (!propertyId || !nightAuditId || !warningType || !reason) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }
    
    await assertPropertyAccess(session.user.id, propertyId);

    const auditRun = await prisma.nightAudit.findUnique({
      where: { id: nightAuditId }
    });

    if (!auditRun) {
      return errorResponse('NOT_FOUND', 'Night audit run not found', 404);
    }

    const ack = await prisma.nightAuditAcknowledgement.create({
      data: {
        nightAuditId,
        userId: session.user.id,
        warningType,
        reason,
        comment
      }
    });

    return successResponse({ message: 'Warning acknowledged', ack });

  } catch (err: any) {
    console.error('[Night Audit Ack POST]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

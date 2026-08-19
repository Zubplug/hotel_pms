import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId, type, reason, requestedEntityId, requestedEntityType, metadata } = body;

    if (!propertyId || !type || !reason) {
      return errorResponse('BAD_REQUEST', 'Missing required fields (propertyId, type, reason)', 400);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const approval = await prisma.approvalRequest.create({
      data: {
        propertyId,
        requestedBy: session.user.id,
        type,
        status: 'PENDING',
        reason,
        requestedEntityId: requestedEntityId || null,
        requestedEntityType: requestedEntityType || null,
        metadata: metadata || {}
      }
    });

    await NotificationEngine.emit({
      type: 'APPROVAL_REQUESTED',
      organizationId: property.organizationId,
      propertyId,
      entityType: 'approval',
      entityId: approval.id,
      idempotencyKey: `approval_${approval.id}`,
      metadata: { requestReason: reason, type }
    });

    return successResponse(approval, 201);
  } catch (err: any) {
    console.error('[Approvals Request POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error creating approval request', 500);
  }
}

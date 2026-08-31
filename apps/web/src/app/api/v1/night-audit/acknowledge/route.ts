import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const userRole = (session.user as any).role;
    if (!['NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'SUPER_ADMIN'].includes(userRole)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await req.json();
    let { propertyId, nightAuditId, warningType, reason, comment } = body;

    if (!propertyId || !warningType || !reason) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }
    
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // If nightAuditId is not provided (e.g. acknowledging before first run), find or create a PENDING run
    if (!nightAuditId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { businessDate: true }
      });
      if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);
      
      const businessDate = property.businessDate || new Date();
      let pendingRun = await prisma.nightAudit.findFirst({
        where: { propertyId, businessDate, status: { in: ['PENDING', 'FAILED'] } },
        orderBy: { createdAt: 'desc' }
      });

      if (!pendingRun) {
        pendingRun = await prisma.nightAudit.create({
          data: {
            propertyId,
            businessDate,
            status: 'PENDING',
            runBy: session.user.id
          }
        });
      }
      nightAuditId = pendingRun.id;
    }

    const auditRun = await prisma.nightAudit.findUnique({
      where: { id: nightAuditId },
      include: { property: { select: { organizationId: true } } }
    });

    if (!auditRun) {
      return errorResponse('NOT_FOUND', 'Night audit run not found', 404);
    }

    const ack = await prisma.$transaction(async (tx) => {
      const createdAck = await tx.nightAuditAcknowledgement.create({
        data: {
          nightAuditId,
          userId: session.user.id,
          warningType,
          reason,
          comment
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: auditRun.property.organizationId,
          propertyId,
          userId: session.user.id,
          userEmail: session.user.email || 'unknown',
          userRole: String(userRole || 'STAFF'),
          action: 'NIGHT_AUDIT_WARNING_ACKNOWLEDGED',
          resource: 'NightAudit',
          resourceId: nightAuditId,
          newValue: JSON.parse(JSON.stringify({ warningType, reason, comment })),
          requestId: crypto.randomUUID()
        }
      });

      return createdAck;
    });

    return successResponse({ message: 'Warning acknowledged', ack });

  } catch (err: any) {
    console.error('[Night Audit Ack POST]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

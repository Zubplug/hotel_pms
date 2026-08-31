import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import { executeNightAudit } from '@/lib/night-audit';
import prisma from '@hotel-pms/db';
import { NotificationEngine } from '@/lib/notification-engine';
import { getOperationalReview, getFinancialAudit, getSystemIntegrity } from '@/lib/night-audit-service';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const propertyId = body.propertyId;

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    }

    const ctx = await requireOrganizationContext(session.user.id);

    if (!ctx.propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'User not authorized for this property', 403);
    } // Requires the dedicated 'night_audit:execute' permission.
    // This is seeded via the add_night_audit_permission migration.
    const canRun = await hasPermission(session.user.id, 'night_audit', 'execute', propertyId);
    if (!canRun) return errorResponse('FORBIDDEN', 'Insufficient permissions to run night audit', 403);

    // Acknowledgement gate — verify all warnings for the pending run have been acknowledged.
    // Acknowledgements are tied to the specific NightAudit run ID (not just businessDate)
    // so that a failed run's stale acks are ignored on retry.
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { requireAuditAcknowledgements: true, businessDate: true }
    });

    if (property?.requireAuditAcknowledgements) {
      const pendingRun = await prisma.nightAudit.findFirst({
        where: { propertyId, businessDate: property.businessDate!, status: { in: ['PENDING', 'FAILED'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      });

      if (pendingRun) {
        const [operationalReview, financialAudit, systemIntegrity] = await Promise.all([
          getOperationalReview(ctx, propertyId),
          getFinancialAudit(ctx, propertyId),
          getSystemIntegrity(ctx, propertyId)
        ]);

        const requiredAckTypes: string[] = [];
        if (operationalReview.arrivals.some((a: any) => a.status === 'CONFIRMED')) requiredAckTypes.push('PENDING_ARRIVALS');
        if (operationalReview.departures.some((d: any) => d.status === 'CHECKED_IN')) requiredAckTypes.push('PENDING_DEPARTURES');
        if (financialAudit.highBalances.length > 0) requiredAckTypes.push('HIGH_BALANCE');
        if (financialAudit.rateVariances.length > 0) requiredAckTypes.push('RATE_VARIANCE');

        if (requiredAckTypes.length > 0) {
          const acks = await prisma.nightAuditAcknowledgement.findMany({
            where: { nightAuditId: pendingRun.id },
            select: { warningType: true }
          });
          const ackedTypes = new Set(acks.map((a: { warningType: string }) => a.warningType));
          const missing = requiredAckTypes.filter(t => !ackedTypes.has(t));
          if (missing.length > 0) {
            return errorResponse(
              'ACKNOWLEDGEMENT_REQUIRED',
              `All Night Audit warnings must be acknowledged before execution. Missing: ${missing.join(', ')}`,
              409
            );
          }
        }
      }
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'SYSTEM';

    const result = await executeNightAudit(
      ctx,
      propertyId, 
      session.user.id, 
      session.user.email ?? null, 
      (session.user as any).role || 'SYSTEM',
      ipAddress,
      userAgent
    );

    return successResponse({
      message: 'Night Audit successfully executed.',
      ...result
    });

  } catch (err: any) {
    if (err.message && err.message.includes(':')) {
      const [code, msg] = err.message.split(':');
      const statusCode = code === 'NOT_FOUND' ? 404 : (code === 'FORBIDDEN' ? 403 : 409);
      return errorResponse(code, msg, statusCode);
    }
    
    console.error('[Night Audit POST]', err);
    
    // Attempt failure notification
    try {
      const reqBody = await req.clone().json().catch(() => ({}));
      if (reqBody.propertyId) {
        const prop = await prisma.property.findUnique({ where: { id: reqBody.propertyId } });
        if (prop) {
           await NotificationEngine.emit({
             type: 'NIGHT_AUDIT_FAILED',
             organizationId: prop.organizationId,
             propertyId: prop.id,
             entityType: 'night_audit',
             entityId: 'failed_run',
             idempotencyKey: `night_audit_fail_${prop.id}_${new Date().toISOString().split('T')[0]}`,
             metadata: { error: err.message }
           });
        }
      }
    } catch (e) {
       console.error('[Night Audit POST] Failed to emit failure notification', e);
    }

    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

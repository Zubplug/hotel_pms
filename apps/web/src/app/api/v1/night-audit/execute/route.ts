import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import { executeNightAudit } from '@/lib/night-audit';
import prisma from '@hotel-pms/db';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    await assertPropertyAccess(session.user.id, propertyId);

    // Basic permission check (in a real app, require specific NIGHT_AUDIT permission)
    const canRun = await hasPermission(session.user.id, 'housekeeping', 'create', propertyId);
    if (!canRun) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'SYSTEM';

    const result = await executeNightAudit(
      propertyId, 
      session.user.id, 
      session.user.email, 
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

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { executeNightAudit } from '@/lib/night-audit';
import { hasPermission } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId || propertyId === 'ALL_AUTHORIZED') {
      return errorResponse('BAD_REQUEST', 'Please specify a single valid propertyId', 400);
    }
    
    const { requireOrganizationContext } = await import('@/lib/organization-access');
    const ctx = await requireOrganizationContext(user.id);

    const hasSpecificAccess = ctx.propertyIds.includes(propertyId);
    if (!hasSpecificAccess) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const canExecute = await hasPermission(user.id, 'night_audit', 'execute', propertyId);
    if (!canExecute) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'SYSTEM';

    const result = await executeNightAudit(
      propertyId, 
      user.id, 
      user.email, 
      user.role || 'SYSTEM',
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
    console.error('[Mobile Night Audit Execute POST]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { getNightAuditPreview } from '@/lib/night-audit';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);

    const hasGlobalAccess = user.isSuperAdmin;
    const hasSpecificAccess = user.allowedProperties.includes(propertyId);
    if (!hasGlobalAccess && !hasSpecificAccess) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const preview = await getNightAuditPreview(propertyId);

    return successResponse(preview);

  } catch (err: any) {
    if (err.message && err.message.includes(':')) {
      const [code, msg] = err.message.split(':');
      const statusCode = code === 'NOT_FOUND' ? 404 : (code === 'FORBIDDEN' ? 403 : 409);
      return errorResponse(code, msg, statusCode);
    }
    console.error('[Mobile Night Audit Preview GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

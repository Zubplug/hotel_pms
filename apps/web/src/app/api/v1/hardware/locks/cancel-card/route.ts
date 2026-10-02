import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { lockOrchestrator } from '@/lib/locks/orchestrator';
import { hasPropertyModuleEntitlement } from '@/lib/auth/service-entitlement';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    if (!(await hasPropertyModuleEntitlement(session.user.id, propertyId, 'MODULE_PMS'))) {
      return errorResponse('PAYMENT_REQUIRED', 'An active PMS entitlement is required for Smart Access.', 402);
    }

    const op = await lockOrchestrator.cancelCard(propertyId, session.user.id);

    return successResponse({ operation: op });
  } catch (err: unknown) {
    console.error('[Cancel Card POST]', err);
    return errorResponse('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500);
  }
}

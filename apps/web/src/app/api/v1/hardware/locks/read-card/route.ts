import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { lockOrchestrator } from '@/lib/locks/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);

    const op = await lockOrchestrator.readCard(propertyId, session.user.id);

    return successResponse({ operation: op });
  } catch (err: unknown) {
    console.error('[Read Card POST]', err);
    return errorResponse('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500);
  }
}

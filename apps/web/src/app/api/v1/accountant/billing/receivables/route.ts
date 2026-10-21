import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getReceivablesScope, listReceivables } from '@/lib/services/receivables-read-model';

const querySchema = z.object({
  propertyId: z.string().uuid().optional(),
  currency: z.string().trim().length(3).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(1024).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) return errorResponse('INVALID_FILTER', 'Invalid receivables filters.', 400, parsed.error.flatten());
    const input = parsed.data;
    const propertyId = input.propertyId || session.user.propertyId;
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
    const scope = await getReceivablesScope(session.user.id, propertyId);
    return successResponse(await listReceivables(scope, input));
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Receivables read access is not available for this property.', 403);
    if (error instanceof Error && error.message === 'INVALID_CURSOR') return errorResponse('INVALID_CURSOR', 'The receivables cursor is invalid or belongs to different filters.', 400);
    return errorResponse('INTERNAL_ERROR', 'Receivables register is unavailable.', 500);
  }
}

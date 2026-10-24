import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { BILLING_SOURCES, getBillingScope, listActiveCorporateFolios, listBillingDocuments } from '@/lib/services/billing-read-model';

const querySchema = z.object({
  propertyId: z.string().uuid().optional(),
  source: z.enum(BILLING_SOURCES).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  q: z.string().trim().max(120).optional(),
  currency: z.string().trim().length(3).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(1024).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) return errorResponse('INVALID_FILTER', 'Invalid Billing register filters.', 400, parsed.error.flatten());
    const input = parsed.data;
    const propertyId = input.propertyId || session.user.propertyId;
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
    const scope = await getBillingScope(session.user.id, propertyId);
    const [result, activeCorporateFolios] = await Promise.all([
      listBillingDocuments(scope, { source: input.source, status: input.status, query: input.q, currency: input.currency, from: input.from, to: input.to, limit: input.limit, cursor: input.cursor }),
      listActiveCorporateFolios(scope, input.q),
    ]);
    return successResponse({ ...result, activeCorporateFolios });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Billing read access is not available for this property.', 403);
    if (error instanceof Error && error.message === 'INVALID_CURSOR') return errorResponse('INVALID_CURSOR', 'The Billing register cursor is invalid or belongs to different filters.', 400);
    return errorResponse('INTERNAL_ERROR', 'Billing invoice register is unavailable.', 500);
  }
}

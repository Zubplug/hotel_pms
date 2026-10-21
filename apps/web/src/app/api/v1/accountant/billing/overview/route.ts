import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getBillingOverview, getBillingScope } from '@/lib/services/billing-read-model';
import { z } from 'zod';

const dateQuery = z.string().datetime({ offset: true }).optional();

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const params = req.nextUrl.searchParams;
    const propertyId = params.get('propertyId') || session.user.propertyId;
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
    const asOf = dateQuery.safeParse(params.get('asOf') || undefined);
    const from = dateQuery.safeParse(params.get('from') || undefined);
    const to = dateQuery.safeParse(params.get('to') || undefined);
    if (!asOf.success || !from.success || !to.success) return errorResponse('INVALID_FILTER', 'Invalid ISO date filter.', 400);
    const scope = await getBillingScope(session.user.id, propertyId, asOf.data ? new Date(asOf.data) : new Date());
    const result = await getBillingOverview(scope, {
      currency: params.get('currency') || undefined,
      from: from.data ? new Date(from.data) : undefined,
      to: to.data ? new Date(to.data) : undefined,
    });
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Billing read access is not available for this property.', 403);
    return errorResponse('INTERNAL_ERROR', 'Billing overview is unavailable.', 500);
  }
}

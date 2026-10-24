import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { getCorporateQuote } from '@/lib/booking-engine/corporate-quote-service';
import { corporateError, corporatePrincipalForQuote, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'quotes:read');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'quotes:read'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const { id } = await context.params;
    const principal = await corporatePrincipalForQuote(auth.principal, id);
    const quote = await getCorporateQuote(prisma as any, principal, id);
    return withRequestId(successResponse({ quoteId: quote.id, status: quote.status, expiresAt: quote.expiresAt, snapshot: quote.snapshot }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

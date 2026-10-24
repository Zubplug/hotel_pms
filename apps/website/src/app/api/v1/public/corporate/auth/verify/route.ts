import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { consumeCorporatePortalLoginToken } from '@/lib/corporate-portal-auth';

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-portal-verify'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid login link', 400);
  const result = await consumeCorporatePortalLoginToken(parsed.data.token);
  if (!result || result.identity.propertyId !== ctx.propertyId || result.identity.organizationId !== ctx.organizationId) return errorResponse('UNAUTHORIZED', 'This login link is invalid or has expired', 401);
  return successResponse({ accessToken: result.sessionToken, expiresAt: result.expiresAt, account: result.identity.corporateAccount });
}

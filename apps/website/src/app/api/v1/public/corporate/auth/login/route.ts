import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { authenticateCorporatePortalPassword } from '@/lib/corporate-portal-auth';

const schema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(8).max(200) });

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-portal-password-login'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many login attempts. Try again shortly.', 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse('BAD_REQUEST', 'A valid corporate email and password are required', 400);
  const result = await authenticateCorporatePortalPassword({ organizationId: ctx.organizationId, propertyId: ctx.propertyId, email: parsed.data.email, password: parsed.data.password });
  if (!result || result.identity.organizationId !== ctx.organizationId || result.identity.propertyId !== ctx.propertyId) return errorResponse('UNAUTHORIZED', 'Invalid corporate email or password', 401);
  return successResponse({ accessToken: result.sessionToken, expiresAt: result.expiresAt, account: result.identity.corporateAccount });
}

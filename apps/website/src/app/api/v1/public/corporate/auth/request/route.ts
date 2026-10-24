import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolvePublicApiContext, isErrorResponse, checkRateLimit, rateLimitIdentity } from '@/lib/booking-engine/middleware';
import { createCorporatePortalLoginRequest } from '@/lib/corporate-portal-auth';
import { sendCorporatePortalLoginEmail } from '@/lib/email/send-corporate-portal-login';

const schema = z.object({ email: z.string().trim().email().max(320) });

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  if (!(await checkRateLimit(rateLimitIdentity(req), 'corporate-portal-login'))) return errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse('BAD_REQUEST', 'A valid corporate email is required', 400);
  const result = await createCorporatePortalLoginRequest({ organizationId: ctx.organizationId, propertyId: ctx.propertyId, email: parsed.data.email });
  if (result.loginToken && result.account) {
    try { await sendCorporatePortalLoginEmail({ to: parsed.data.email, accountName: result.account.name, loginToken: result.loginToken, expiresAt: result.expiresAt }); } catch (error) { console.error('[CorporatePortal] login email failed', error); }
  }
  return successResponse({ accepted: result.accepted, expiresAt: result.expiresAt });
}

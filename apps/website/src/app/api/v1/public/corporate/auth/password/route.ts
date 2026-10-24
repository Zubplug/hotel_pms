import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolvePublicApiContext, isErrorResponse } from '@/lib/booking-engine/middleware';
import { setCorporatePortalPassword } from '@/lib/corporate-portal-auth';

const schema = z.object({ accessToken: z.string().min(20).max(200), password: z.string().min(8).max(200) });

export async function POST(req: NextRequest) {
  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse('BAD_REQUEST', 'A password of at least 8 characters is required', 400);
  const updated = await setCorporatePortalPassword({ organizationId: ctx.organizationId, propertyId: ctx.propertyId, sessionToken: parsed.data.accessToken, password: parsed.data.password });
  if (!updated) return errorResponse('UNAUTHORIZED', 'Your secure access link has expired. Request a new one.', 401);
  return successResponse({ passwordSet: true });
}

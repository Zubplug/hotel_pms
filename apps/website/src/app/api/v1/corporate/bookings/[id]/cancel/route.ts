import { NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { cancelCorporateReservation, corporateCancellationPreview, findCorporateReservation } from '@/lib/booking-engine/corporate-cancellation-service';
import { corporateError, jsonBody, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

const bodySchema = z.object({ reason: z.string().max(500).optional(), preview: z.boolean().optional() });

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCorporateApi(req, 'bookings:cancel');
  if (auth instanceof Response) return auth;
  if (!(await checkCorporateRateLimit(auth.principal, 'bookings:cancel'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const id = (await context.params).id;
    const body = await jsonBody(req, auth.principal.requestSizeLimitBytes);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return withRequestId(errorResponse('BAD_REQUEST', 'Invalid cancellation payload', 400, parsed.error.flatten()), auth.requestId);
    const reservation = await findCorporateReservation(prisma as any, auth.principal, id);
    if (parsed.data.preview) return withRequestId(successResponse({ reservationId: id, ...corporateCancellationPreview(reservation) }), auth.requestId);
    return withRequestId(successResponse(await cancelCorporateReservation(prisma as any, auth.principal, id, parsed.data.reason), 200), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}

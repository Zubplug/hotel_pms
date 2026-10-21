import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getPaymentRegisterScope, listPaymentRegister, PAYMENT_METHODS, PAYMENT_STATUSES } from '@/lib/services/payment-read-model';

const querySchema = z.object({
  propertyId: z.string().uuid().optional(),
  source: z.string().trim().max(40).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  currency: z.string().trim().length(3).optional(),
  q: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  amountMin: z.string().regex(/^\d+(?:\.\d{1,4})?$/).optional(),
  amountMax: z.string().regex(/^\d+(?:\.\d{1,4})?$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(1024).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (!parsed.success) return errorResponse('INVALID_FILTER', 'Invalid payment register filters.', 400, parsed.error.flatten());
    const input = parsed.data;
    const propertyId = input.propertyId || session.user.propertyId;
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
    const scope = await getPaymentRegisterScope(session.user.id, propertyId);
    const result = await listPaymentRegister(scope, input);
    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Payment read access is not available for this property.', 403);
    if (error instanceof Error && error.message === 'INVALID_CURSOR') return errorResponse('INVALID_CURSOR', 'The payment register cursor is invalid or belongs to different filters.', 400);
    return errorResponse('INTERNAL_ERROR', 'Payment register is unavailable.', 500);
  }
}

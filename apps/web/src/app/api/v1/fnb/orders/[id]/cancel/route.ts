import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PosOrderService } from '@/lib/pos/PosOrderService';
import crypto from 'crypto';
import { successResponse, errorResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { reason, businessDate } = await req.json();
    if (!reason || !businessDate) {
      return errorResponse('BAD_REQUEST', 'Missing reason or businessDate', 400);
    }

    // Ensure idempotency: an order can only be cancelled once.
    const operationId = `cancel-order-${id}`;

    const result = await PosOrderService.cancelOrder({
      orderId: id,
      reason,
      authorizerId: session.user.id,
      operationId,
      businessDate
    });

    return successResponse(result, 200);
  } catch (err: any) {
    console.error('[FNB Order Cancel]', err);
    return errorResponse('INTERNAL_ERROR', err.message || 'Failed to cancel order', 500);
  }
}

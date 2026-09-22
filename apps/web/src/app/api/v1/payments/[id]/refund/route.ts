import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-response';

/**
 * Legacy payment refunds are intentionally disabled. Refunds must originate
 * from Front Desk > Guest Credits so the guest-credit liability and approval
 * workflow remain the single source of truth.
 */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  return errorResponse('FORBIDDEN', 'Refund requests must be submitted by Front Desk from the Guest Credits tab.', 403);
}

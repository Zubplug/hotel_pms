import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { CashHandoverService } from '@/lib/services/cash-handover-service';
import { CASH_HANDOVER_ROLES, hasFinancialRole } from '@/lib/financial-control-access';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!user.isSuperAdmin && !hasFinancialRole(String(user.role || ''), CASH_HANDOVER_ROLES)) return errorResponse('FORBIDDEN', 'You cannot receive cash handovers', 403);
    const ctx = await requireOrganizationContext(user.id);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await CashHandoverService.receiveHandover(ctx, { handoverId: id, notes: typeof body.notes === 'string' ? body.notes.trim() : undefined });
    return successResponse({ handover: result });
  } catch (error: any) {
    console.error('[Mobile cashier handover receive]', error);
    return errorResponse(error.code || 'INTERNAL_ERROR', error.message || 'Unable to receive handover', error.status || 500);
  }
}

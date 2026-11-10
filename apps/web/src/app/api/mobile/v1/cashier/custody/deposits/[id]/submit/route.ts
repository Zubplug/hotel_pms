import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { BankDepositService } from '@/lib/services/bank-deposit-service';
import { DEPOSIT_SUBMIT_ROLES, hasFinancialRole } from '@/lib/financial-control-access';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!user.isSuperAdmin && !hasFinancialRole(user.role, DEPOSIT_SUBMIT_ROLES)) return errorResponse('FORBIDDEN', 'You cannot submit deposits', 403);
    const ctx = await requireOrganizationContext(user.id);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (!body.bankAccountId) return errorResponse('BAD_REQUEST', 'Select a receiving bank account', 400);
    const result = await BankDepositService.submitDeposit(ctx, { depositId: id, bankAccountId: String(body.bankAccountId), bankReference: typeof body.bankReference === 'string' ? body.bankReference.trim() || undefined : undefined, bankReceiptUrl: typeof body.bankReceiptUrl === 'string' ? body.bankReceiptUrl.trim() || undefined : undefined });
    return successResponse({ deposit: result });
  } catch (error: any) {
    console.error('[Mobile cashier deposit submit]', error);
    return errorResponse(error.code || 'INTERNAL_ERROR', error.message || 'Unable to submit deposit', error.status || 500);
  }
}

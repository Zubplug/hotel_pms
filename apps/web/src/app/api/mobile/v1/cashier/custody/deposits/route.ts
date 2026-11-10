import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext(user.id);
    const propertyId = req.nextUrl.searchParams.get('propertyId') || ctx.propertyIds[0];
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
    const [deposits, bankAccounts] = await Promise.all([
      prisma.bankDeposit.findMany({ where: { propertyId, status: 'PENDING_HANDOVER' }, orderBy: { createdAt: 'asc' }, include: { allocations: { select: { posSessionId: true, frontdeskSessionId: true } } } }),
      prisma.cashAccount.findMany({ where: { propertyId, type: 'BANK_ACCOUNT', isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true, bankName: true, accountNumber: true, isDefault: true } }),
    ]);
    return successResponse({
      propertyId,
      deposits: deposits.map((deposit) => ({ id: deposit.id, reference: deposit.depositReference, amount: Number(deposit.expectedAmount), status: deposit.status, createdAt: deposit.createdAt, bankName: deposit.bankName, bankReference: deposit.bankReference, sessionCount: deposit.allocations.length })),
      bankAccounts,
    });
  } catch (error) {
    console.error('[Mobile cashier deposits GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load pending deposits', 500);
  }
}

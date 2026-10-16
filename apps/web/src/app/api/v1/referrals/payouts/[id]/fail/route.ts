import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const role = String((session.user as any).role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'].includes(role)) return errorResponse('FORBIDDEN', 'Finance authorization required', 403);
    const ctx = await requireOrganizationContext(String(session.user.id));
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const payout = await prisma.$transaction(async (tx: any) => {
      const current = await tx.referralPayout.findUnique({ where: { id }, include: { commissions: true } });
      if (!current) throw new Error('NOT_FOUND');
      if (current.organizationId !== ctx.organizationId || !ctx.propertyIds.includes(current.propertyId)) throw new Error('FORBIDDEN');
      if (!['PENDING', 'PROCESSING'].includes(current.status)) throw new Error('CONFLICT');
      await tx.referralCommission.updateMany({ where: { id: { in: current.commissions.map((item: any) => item.commissionId) } }, data: { status: 'PAYABLE' } });
      return tx.referralPayout.update({ where: { id }, data: { status: 'FAILED', failureReason: String(body.reason || 'Payout failed') } });
    });
    return successResponse(payout);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Payout not found', 404);
    if (error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied', 403);
    if (error.message === 'CONFLICT') return errorResponse('CONFLICT', 'Payout is no longer pending or processing', 409);
    return errorResponse('INTERNAL_ERROR', 'Unable to mark Reach payout failed', 500);
  }
}

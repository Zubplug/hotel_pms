import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const userId = String(session.user.id);
    const ctx = await requireOrganizationContext(userId);
    const role = String((session.user as any).role || '').toUpperCase();
    if (!['OWNER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT'].includes(role)) return errorResponse('FORBIDDEN', 'Finance authorization required', 403);
    const body = await req.json().catch(() => ({}));
    const propertyId = String(body.propertyId || '');
    const partnerId = String(body.partnerId || '');
    if (!propertyId || !partnerId || !ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'A permitted property and partner are required', 403);

    const payout = await prisma.$transaction(async (tx: any) => {
      const program = await tx.referralProgram.findUnique({ where: { propertyId }, select: { organizationId: true, minimumPayout: true } });
      if (!program || program.organizationId !== ctx.organizationId) throw new Error('FORBIDDEN');
      const commissions = await tx.referralCommission.findMany({
        where: {
          organizationId: ctx.organizationId,
          propertyId,
          partnerId,
          status: { in: ['APPROVED', 'PAYABLE'] },
        },
        orderBy: { earnedAt: 'asc' },
      });
      const payable = commissions.filter((commission: any) => Number(commission.amount) - Number(commission.reversedAmount) > 0.01);
      const amount = payable.reduce((sum: number, commission: any) => sum + Number(commission.amount) - Number(commission.reversedAmount), 0);
      if (amount < Number(program.minimumPayout)) throw new Error('MINIMUM_NOT_REACHED');
      const currency = payable[0]?.currency || 'NGN';
      const created = await tx.referralPayout.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId,
          partnerId,
          amount,
          currency,
          status: 'PENDING',
          commissions: { create: payable.map((commission: any) => ({ commissionId: commission.id, amount: Number(commission.amount) - Number(commission.reversedAmount) })) },
        },
        include: { commissions: true },
      });
      await tx.referralCommission.updateMany({ where: { id: { in: payable.map((commission: any) => commission.id) } }, data: { status: 'PROCESSING' } });
      return created;
    });
    return successResponse(payout, 201);
  } catch (error: any) {
    if (error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied', 403);
    if (error.message === 'MINIMUM_NOT_REACHED') return errorResponse('CONFLICT', 'The partner has not reached the minimum payout threshold', 409);
    console.error('[Reach payout creation]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to create Reach payout', 500);
  }
}

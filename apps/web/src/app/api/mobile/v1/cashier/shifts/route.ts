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
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const statuses = ['OPEN', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'APPROVED_WITH_VARIANCE', 'RECONCILED'];
    const [pos, frontDesk] = await Promise.all([
      prisma.posSession.findMany({
        where: { propertyId, controlStatus: { in: statuses } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          outlet: { select: { name: true } },
          primaryOperator: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.frontdeskSession.findMany({
        where: { propertyId, controlStatus: { in: statuses } },
        orderBy: { openedAt: 'desc' },
        take: 100,
        include: {
          staff: { select: { firstName: true, lastName: true } },
          cashAccount: { select: { name: true } },
        },
      }),
    ]);

    const shifts = [
      ...pos.map((shift) => {
        const expected = Number(shift.openingCash) + Number(shift.cashSales) + Number(shift.cashIn) - Number(shift.cashRefunds) - Number(shift.cashOut);
        const declared = shift.actualCash == null ? null : Number(shift.actualCash);
        return {
          id: shift.id, type: 'POS', label: shift.outlet.name,
          operator: shift.primaryOperator ? `${shift.primaryOperator.firstName} ${shift.primaryOperator.lastName}`.trim() : 'Unassigned operator',
          status: shift.status, controlStatus: shift.controlStatus,
          businessDate: shift.businessDate, openedAt: shift.openedAt, closedAt: shift.closedAt, updatedAt: shift.updatedAt,
          expected, declared, variance: declared == null ? null : declared - expected,
          openingFloat: Number(shift.openingCash), approvalNotes: shift.approvalNotes,
        };
      }),
      ...frontDesk.map((shift) => ({
        id: shift.id, type: 'FRONT_DESK', label: shift.cashAccount.name,
        operator: `${shift.staff.firstName} ${shift.staff.lastName}`.trim(),
        status: shift.status, controlStatus: shift.controlStatus,
        businessDate: shift.businessDate, openedAt: shift.openedAt, closedAt: shift.closedAt, updatedAt: shift.updatedAt,
        expected: Number(shift.systemExpectedCash),
        declared: shift.declaredCash == null ? null : Number(shift.declaredCash),
        variance: shift.variance == null ? null : Number(shift.variance),
        openingFloat: Number(shift.openingFloat), approvalNotes: shift.approvalNotes,
      })),
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return successResponse({ propertyId, shifts });
  } catch (error) {
    console.error('[Mobile cashier shifts GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load cashier shifts', 500);
  }
}

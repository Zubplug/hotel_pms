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

    const handovers = await prisma.cashHandover.findMany({
      where: { propertyId, status: 'PENDING' },
      orderBy: { handedOverAt: 'asc' },
      include: {
        handedOverBy: { select: { firstName: true, lastName: true } },
        posSessions: { select: { id: true, outlet: { select: { name: true } } } },
        frontdeskSessions: { select: { id: true, cashAccount: { select: { name: true } } } },
      },
    });

    return successResponse({
      propertyId,
      handovers: handovers.map((handover) => ({
        id: handover.id,
        reference: handover.handoverReference,
        amount: Number(handover.amount),
        status: handover.status,
        handedOverAt: handover.handedOverAt,
        safeReference: handover.safeReference,
        notes: handover.notes,
        handedOverBy: handover.handedOverBy ? `${handover.handedOverBy.firstName} ${handover.handedOverBy.lastName}`.trim() : 'Operator',
        sessions: [
          ...handover.posSessions.map((session) => session.outlet.name),
          ...handover.frontdeskSessions.map((session) => session.cashAccount.name),
        ],
        paymentBreakdown: handover.paymentBreakdown,
      })),
    });
  } catch (error) {
    console.error('[Mobile cashier handovers GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load pending handovers', 500);
  }
}

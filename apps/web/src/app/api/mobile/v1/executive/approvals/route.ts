import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { prisma } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const propertyId = req.nextUrl.searchParams.get('propertyId') || 'ALL_AUTHORIZED';
    const allowedPropertyIds = ctx.propertyIds;
    const targetProperties = propertyId === 'ALL_AUTHORIZED' ? [...allowedPropertyIds] : [propertyId];

    if (targetProperties.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }


    const [pendingApprovals, stockTransfers] = await Promise.all([
      prisma.approvalRequest.findMany({
        where: {
          propertyId: { in: targetProperties },
          status: 'PENDING'
        },
        include: {
          property: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.stockTransfer.findMany({
        where: {
          propertyId: { in: targetProperties },
          OR: [
            { status: 'PENDING_APPROVAL' }, // Waiting for approval (could be top mgmt or stock mgmt)
            { status: 'ISSUED' }, // Waiting for confirmation receipt
          ]
        },
        include: {
          property: { select: { name: true } },
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true, posOutletId: true } },
          items: {
            include: { stockItem: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    ]);

    // Format stock transfers to match the ApprovalRequest shape for the UI
    const mappedTransfers = stockTransfers.map(st => {
      const totalValue = st.items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.stockItem.costPrice || 0), 0);
      return {
        id: st.id,
        propertyId: st.propertyId,
        property: st.property,
        type: 'STOCK_TRANSFER',
        status: 'PENDING', // Mapped visually to 'Pending' in UI
        amount: totalValue,
        currency: 'NGN',
        reason: st.notes || 'No reason provided',
        details: {
          reference: st.transferRef,
          productName: `Transfer: ${st.fromWarehouse.name} to ${st.toWarehouse.name}`,
          isOutletBound: Boolean(st.toWarehouse.posOutletId),
          originalStatus: st.status, // PENDING_APPROVAL or ISSUED
        },
        requestedAt: st.createdAt.toISOString()
      };
    });

    const combined = [...pendingApprovals, ...mappedTransfers]
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
      .slice(0, 100);

    return successResponse(combined, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Approvals GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching approvals', 500);
  }
}

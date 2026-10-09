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
    const role = String(user.role || '').toUpperCase();
    const canViewStockTransfers = user.isSuperAdmin || role === 'STOCK_MANAGER';
    const propertyId = req.nextUrl.searchParams.get('propertyId') || 'ALL_AUTHORIZED';
    const allowedPropertyIds = ctx.propertyIds;
    const targetProperties = propertyId === 'ALL_AUTHORIZED' ? [...allowedPropertyIds] : [propertyId];

    if (targetProperties.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }


    const [pendingApprovals, stockTransfers, purchaseOrders] = await Promise.all([
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
          ...(canViewStockTransfers ? {
            OR: [
              { status: 'PENDING_APPROVAL' },
              { status: 'ISSUED' },
            ]
          } : { id: { in: [] } }),
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
      }),
      prisma.purchaseOrder.findMany({
        where: {
          propertyId: { in: targetProperties },
          status: 'SUBMITTED',
          ...(user.isSuperAdmin ? {} : role === 'ACCOUNTANT'
            ? { OR: [{ approvalStage: 'ACCOUNTANT' }, { approvalStage: null }] }
            : role === 'GENERAL_MANAGER'
              ? { approvalStage: 'GENERAL_MANAGER' }
              : { propertyId: { in: [] } }),
        },
        include: {
          property: { select: { name: true } },
          supplier: { select: { name: true, contactName: true, phone: true, email: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
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

    const stockItemIds = [...new Set(purchaseOrders.flatMap((purchaseOrder) => purchaseOrder.items.map((item) => item.stockItemId).filter((id): id is string => Boolean(id))))];
    const stockItems = stockItemIds.length ? await prisma.stockItem.findMany({ where: { id: { in: stockItemIds } }, select: { id: true, name: true, baseUnit: true } }) : [];
    const stockItemById = new Map(stockItems.map((item) => [item.id, item]));
    const mappedPurchaseOrders = purchaseOrders.map((po) => ({
      id: po.id,
      propertyId: po.propertyId,
      property: po.property,
      type: 'PURCHASE_ORDER',
      status: 'PENDING',
      amount: po.totalAmount,
      currency: po.currency,
      reason: po.notes || 'Purchase order awaiting approval',
      requestedBy: po.createdBy,
      requestedAt: po.createdAt.toISOString(),
      details: {
        reference: po.poNumber,
        productName: `Purchase order ${po.poNumber}`,
        approvalStage: po.approvalStage || 'ACCOUNTANT',
        supplier: po.supplier,
        items: po.items.map((item) => ({ ...item, stockItem: item.stockItemId ? stockItemById.get(item.stockItemId) || null : null })),
        totalAmount: po.totalAmount,
      },
    }));

    const discountRoomIds = pendingApprovals
      .filter((approval) => approval.type === 'DISCOUNT')
      .map((approval) => {
        const snapshot = (approval.snapshot || {}) as Record<string, unknown>;
        const details = (approval.details || {}) as Record<string, unknown>;
        return String(snapshot.reservationRoomId || details.reservationRoomId || '');
      })
      .filter(Boolean);
    const reviewRooms = discountRoomIds.length ? await prisma.reservationRoom.findMany({
      where: { id: { in: discountRoomIds } },
      select: {
        id: true,
        reservationId: true,
        checkIn: true,
        checkOut: true,
        adults: true,
        children: true,
        rateAmount: true,
        currency: true,
        status: true,
        room: { select: { number: true, name: true, roomType: { select: { name: true, code: true } } } },
        reservation: {
          select: {
            confirmationNumber: true,
            checkIn: true,
            checkOut: true,
            status: true,
            source: true,
            adults: true,
            children: true,
            specialRequests: true,
            primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true, companyName: true, isVip: true, vipLevel: true } },
          },
        },
      },
    }) : [];
    const reviewRoomById = new Map(reviewRooms.map((room) => [room.id, room]));
    const enrichedApprovals = pendingApprovals.map((approval) => {
      if (approval.type !== 'DISCOUNT') return approval;
      const snapshot = (approval.snapshot || {}) as Record<string, unknown>;
      const details = (approval.details || {}) as Record<string, unknown>;
      const roomId = String(snapshot.reservationRoomId || details.reservationRoomId || '');
      const reviewRoom = reviewRoomById.get(roomId);
      return { ...approval, details: { ...details, review: reviewRoom || null } };
    });

    const combined = [...enrichedApprovals, ...mappedTransfers, ...mappedPurchaseOrders]
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
      .slice(0, 100);

    return successResponse(combined, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Approvals GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error fetching approvals', 500);
  }
}

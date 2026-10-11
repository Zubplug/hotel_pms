import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

export const dynamic = 'force-dynamic';

const ACCESS_ROLES = new Set(['ACCOUNTANT', 'GENERAL_MANAGER', 'FINANCE_MANAGER', 'GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER', 'MANAGER', 'DIRECTOR', 'HOTEL_MANAGER', 'CEO', 'SUPER_ADMIN', 'ADMIN']);

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!user.isSuperAdmin && !ACCESS_ROLES.has(user.role)) return NextResponse.json({ error: 'Approval center access required' }, { status: 403 });

  const propertyFilter = { propertyId: { in: user.allowedProperties } };
  const [priceApprovalsRaw, refunds, refundApprovals, eventInvoicesRaw, stockTransfers, purchaseOrders] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { ...propertyFilter, type: { in: ['POS_PRICE_CHANGE', 'POS_MENU_CREATE', 'POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'] }, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
    prisma.refundRequest.findMany({
      // The approval center is only for refunds that still require a decision.
      // Completed/failed/rejected refunds remain in refund history and must not
      // reappear as actionable approval work.
      where: { ...propertyFilter, status: 'PENDING_APPROVAL' },
      select: {
        id: true, propertyId: true, requestedById: true, requestedAmount: true, approvedAmount: true,
        currency: true, category: true, reason: true, status: true, createdAt: true, updatedAt: true,
        requestedMethod: true, approvedMethod: true, currentApprovalStep: true, currentApproverId: true,
        approvalRoleId: true,
        reservation: {
          select: {
            confirmationNumber: true, status: true, checkIn: true, checkOut: true, adults: true, children: true,
            currency: true, ratePlanSnapshot: true,
            primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true } },
            property: { select: { name: true, code: true } },
            reservationRooms: { where: { status: { not: 'CANCELLED' } }, select: { room: { select: { number: true, roomType: { select: { name: true } } } } } },
          },
        },
        payment: { select: { amount: true, status: true, provider: true, providerTransactionId: true, method: true, currency: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
    prisma.approvalRequest.findMany({ where: { ...propertyFilter, type: 'REFUND' }, select: { id: true, status: true, details: true, createdAt: true } }),
    prisma.eventInvoice.findMany({
      where: { OR: [{ event: { propertyId: { in: user.allowedProperties } } }, { propertyId: { in: user.allowedProperties } }], workflowStatus: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'] } },
      include: { event: { include: { guest: true, corporateAccount: true } }, cityLedgerAccount: true, leaseBillingSchedule: { include: { leaseContract: { include: { hall: true, corporateAccount: true } } } }, items: true },
      orderBy: { updatedAt: 'desc' }, take: 200,
    }),
    prisma.stockTransfer.findMany({
      where: { 
        propertyId: { in: user.allowedProperties },
        OR: [{ status: 'PENDING_APPROVAL' }, { status: 'ISSUED' }]
      },
      include: { fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true, posOutletId: true } }, items: { include: { stockItem: true } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
    prisma.purchaseOrder.findMany({
      where: {
        ...propertyFilter,
        status: 'SUBMITTED',
        ...(user.isSuperAdmin ? {} : user.role === 'ACCOUNTANT'
          ? { OR: [{ approvalStage: 'ACCOUNTANT' }, { approvalStage: null }] }
          : user.role === 'GENERAL_MANAGER'
            ? { approvalStage: 'GENERAL_MANAGER' }
            : { propertyId: { in: [] } }),
      },
      include: {
        property: { select: { name: true } },
        supplier: { select: { name: true, contactName: true, phone: true, email: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
  ]);

  const isAccountant = ['ACCOUNTANT', 'FINANCE_MANAGER'].includes(user.role) || user.isSuperAdmin;
  const isCashier = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(user.role);
  const isManagement = ['GENERAL_MANAGER', 'HOTEL_MANAGER', 'MANAGER', 'DIRECTOR', 'CEO', 'ADMIN'].includes(user.role) || user.isSuperAdmin;
  const priceApprovals = priceApprovalsRaw.filter((approval) => {
    const stage = (approval.details as { stage?: string } | null)?.stage;
    return (isAccountant && stage === 'ACCOUNTANT_REVIEW') || (isCashier && stage === 'GENERAL_CASHIER_REVIEW');
  });
  const eventInvoices = eventInvoicesRaw.filter((invoice) =>
    (isAccountant && ['SUBMITTED', 'IN_REVIEW'].includes(invoice.workflowStatus)) ||
    (isCashier && invoice.workflowStatus === 'APPROVED')
  );
  const stockItemIds = [...new Set(purchaseOrders.flatMap((purchaseOrder) => purchaseOrder.items.map((item) => item.stockItemId).filter((id): id is string => Boolean(id))))];
  const stockItems = stockItemIds.length ? await prisma.stockItem.findMany({ where: { id: { in: stockItemIds } }, select: { id: true, name: true, baseUnit: true } }) : [];
  const stockItemById = new Map(stockItems.map((item) => [item.id, item]));
  const purchaseOrdersWithStockItems = purchaseOrders.map((purchaseOrder) => ({
    ...purchaseOrder,
    items: purchaseOrder.items.map((item) => ({ ...item, stockItem: item.stockItemId ? stockItemById.get(item.stockItemId) || null : null })),
  }));
  const refundApprovalByRequest = new Map<string, (typeof refundApprovals)[number]>();
  for (const approval of refundApprovals.sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING') || b.createdAt.getTime() - a.createdAt.getTime())) {
    const refundRequestId = String((approval.details as { refundRequestId?: string } | null)?.refundRequestId || '');
    if (refundRequestId && !refundApprovalByRequest.has(refundRequestId)) refundApprovalByRequest.set(refundRequestId, approval);
  }
  const scopedRefunds = refunds.filter((refund) => {
    const approval = refundApprovalByRequest.get(refund.id);
    const details = (approval?.details || {}) as { approverId?: string; approverRoleId?: string; stage?: string; stepOrder?: number };
    const stage = details.stage || (refund.currentApprovalStep <= 1 ? 'GENERAL_CASHIER_REVIEW' : refund.currentApprovalStep === 2 ? 'ACCOUNTANT_REVIEW' : 'MANAGEMENT_REVIEW');
    const stageRole = stage === 'GENERAL_CASHIER_REVIEW' ? isCashier : stage === 'ACCOUNTANT_REVIEW' ? isAccountant : isManagement;
    // Older refund requests were created before the three-stage routing was
    // introduced and may contain a legacy manager assignment at step 1. Treat
    // those requests as unassigned cashier-stage work so they are not stranded.
    const assigned = stage === 'MANAGEMENT_REVIEW' || stage === 'MANAGER_REVIEW' || !details.stage || !details.approverId || details.approverId === user.id;
    return stageRole && assigned;
  });

  return NextResponse.json({
    data: {
      priceApprovals,
      refunds: scopedRefunds.map((item) => {
        const approval = refundApprovalByRequest.get(item.id);
        const details = (approval?.details || {}) as { stage?: string };
        const approvalStage = details.stage || (item.currentApprovalStep <= 1 ? 'GENERAL_CASHIER_REVIEW' : item.currentApprovalStep === 2 ? 'ACCOUNTANT_REVIEW' : 'MANAGEMENT_REVIEW');
        return {
          ...item,
          requestedAmount: Number(item.requestedAmount),
          approvedAmount: item.approvedAmount == null ? null : Number(item.approvedAmount),
          payment: item.payment ? { ...item.payment, amount: Number(item.payment.amount) } : null,
          approvalStage,
          approval: approval || null,
        };
      }),
      eventInvoices,
      stockTransfers,
      purchaseOrders: purchaseOrdersWithStockItems,
      role: user.role,
    },
  });
}

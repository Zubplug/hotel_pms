import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

export const dynamic = 'force-dynamic';

const ACCESS_ROLES = new Set(['ACCOUNTANT', 'FINANCE_MANAGER', 'GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER', 'MANAGER', 'DIRECTOR', 'HOTEL_MANAGER', 'CEO', 'SUPER_ADMIN', 'ADMIN']);

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!user.isSuperAdmin && !ACCESS_ROLES.has(user.role)) return NextResponse.json({ error: 'Approval center access required' }, { status: 403 });

  const propertyFilter = { propertyId: { in: user.allowedProperties } };
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id, OR: [{ propertyId: { in: user.allowedProperties } }, { propertyId: null }] },
    select: { roleId: true },
  });
  const userRoleIds = new Set(userRoles.map((role) => role.roleId));
  const [priceApprovalsRaw, refunds, refundApprovals, eventInvoicesRaw] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { ...propertyFilter, type: { in: ['POS_PRICE_CHANGE', 'POS_MENU_CREATE', 'POS_MODIFIER_CREATE', 'POS_MODIFIER_UPDATE'] } },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
    prisma.refundRequest.findMany({
      where: propertyFilter,
      select: { id: true, propertyId: true, requestedById: true, requestedAmount: true, approvedAmount: true, currency: true, category: true, reason: true, status: true, createdAt: true, requestedMethod: true, approvedMethod: true },
      orderBy: { createdAt: 'desc' }, take: 200,
    }),
    prisma.approvalRequest.findMany({ where: { ...propertyFilter, type: 'REFUND' }, select: { id: true, status: true, details: true } }),
    prisma.eventInvoice.findMany({
      where: { event: { propertyId: { in: user.allowedProperties } }, workflowStatus: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'] } },
      include: { event: { include: { guest: true, corporateAccount: true } }, items: true },
      orderBy: { updatedAt: 'desc' }, take: 200,
    }),
  ]);

  const isAccountant = ['ACCOUNTANT', 'FINANCE_MANAGER'].includes(user.role) || user.isSuperAdmin;
  const isCashier = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(user.role);
  const priceApprovals = priceApprovalsRaw.filter((approval) => {
    const stage = (approval.details as { stage?: string } | null)?.stage;
    return (isAccountant && stage === 'ACCOUNTANT_REVIEW') || (isCashier && stage === 'GENERAL_CASHIER_REVIEW');
  });
  const eventInvoices = eventInvoicesRaw.filter((invoice) =>
    (isAccountant && ['SUBMITTED', 'IN_REVIEW'].includes(invoice.workflowStatus)) ||
    (isCashier && invoice.workflowStatus === 'APPROVED')
  );
  const refundApprovalByRequest = new Map(refundApprovals.map((approval) => [String((approval.details as { refundRequestId?: string } | null)?.refundRequestId || ''), approval]));
  const scopedRefunds = refunds.filter((refund) => {
    const approval = refundApprovalByRequest.get(refund.id);
    const details = (approval?.details || {}) as { approverId?: string; approverRoleId?: string };
    // Unassigned requests remain visible to the qualified accounting queue;
    // named assignments are visible only to that staff member or assigned role.
    return isAccountant && (
      refund.requestedById === user.id ||
      !details.approverId && !details.approverRoleId ||
      details.approverId === user.id ||
      Boolean(details.approverRoleId && userRoleIds.has(details.approverRoleId))
    );
  });

  return NextResponse.json({
    data: {
      priceApprovals,
      refunds: scopedRefunds.map((item) => ({ ...item, requestedAmount: Number(item.requestedAmount), approvedAmount: item.approvedAmount == null ? null : Number(item.approvedAmount), approval: refundApprovalByRequest.get(item.id) || null })),
      eventInvoices,
      role: user.role,
    },
  });
}

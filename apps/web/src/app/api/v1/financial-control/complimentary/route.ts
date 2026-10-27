import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';
import { PosPaymentAccountingService } from '@/lib/services/pos-payment-accounting-service';
import { InventoryService } from '@/lib/inventory/InventoryService';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDate = searchParams.get('businessDate');
    const status = searchParams.get('status');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    
    const ctx = await requireOrganizationContext(user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const whereClause: any = { propertyId };
    if (businessDate) whereClause.businessDate = new Date(businessDate);
    if (status) whereClause.status = status;

    const records = await prisma.complimentaryRecord.findMany({
      where: whereClause,
      include: {
        operator: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } },
        acknowledgedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse({ records });
  } catch (err: any) {
    console.error('[Complimentary GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { id, propertyId, status, rejectionReason, nightAuditorId } = body;

    if (!id || !propertyId || !status) return errorResponse('BAD_REQUEST', 'Missing required fields', 400);

    const ctx = await requireOrganizationContext(user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!['NIGHT_AUDITOR', 'GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR', 'ADMIN', 'CEO', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Management or financial-control approval is required', 403);
    if (!['VERIFIED', 'UNRESOLVED', 'REVERSED'].includes(status)) return errorResponse('BAD_REQUEST', 'Invalid complimentary status', 400);
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
    const auditor = await prisma.staff.findFirst({ where: { userId: user.id, organizationId: property?.organizationId, isActive: true }, select: { id: true } });
    if (!auditor) return errorResponse('FORBIDDEN', 'Authenticated user has no active staff profile', 403);

    const record = await prisma.complimentaryRecord.update({
      where: { id, propertyId },
      data: {
        status,
        rejectionReason: rejectionReason || null,
        approverId: status === 'VERIFIED' ? auditor.id : null,
        nightAuditorId: status === 'VERIFIED' ? auditor.id : null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
      include: {
        operator: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } },
      }
    });

    if (status === 'VERIFIED' && record.settlementType === 'STAFF_PAY_LATER' && record.staffId && Number(record.staffLiability) > 0) {
      await prisma.staffReceivable.upsert({
        where: { operationId: `STAFF_COMP_${record.id}` },
        create: {
          propertyId,
          staffId: record.staffId,
          reference: `STAFF-COMP-${record.id}`,
          originalAmount: record.staffLiability,
          outstanding: record.staffLiability,
          sourceId: record.id,
          operationId: `STAFF_COMP_${record.id}`,
        },
        update: {},
      });
    }

    // Pay-later POS concessions are not payments until this control decision.
    // Approval atomically confirms the payment, posts accounting/inventory,
    // and closes the order.
    if (status === 'VERIFIED' && record.posOrderId) {
      await prisma.$transaction(async (tx) => {
        const pendingPayment = await tx.posPayment.findFirst({
          where: { orderId: record.posOrderId!, method: 'COMPLIMENTARY', status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
        });
        if (!pendingPayment) return;
        const order = await tx.posOrder.findUnique({
          where: { id: record.posOrderId! },
          include: {
            property: { select: { organizationId: true } },
            outlet: { select: { type: true } },
            items: { include: { product: { include: { category: true } } } },
          },
        });
        if (!order) throw new Error('POS order linked to complimentary record was not found.');
        const confirmedPayment = await tx.posPayment.update({
          where: { id: pendingPayment.id },
          data: { status: 'CONFIRMED', paidAt: new Date() },
        });
        await PosPaymentAccountingService.processPaymentAccounting(tx, confirmedPayment, order as any, record.approverId || record.nightAuditorId || null);
        await InventoryService.commitSaleInTransaction(tx, order.id, record.approverId || record.nightAuditorId || 'system', `op_sale_${order.id}_${confirmedPayment.id}`);
        await tx.posOrder.update({
          where: { id: order.id },
          data: { status: 'CLOSED', paymentStatus: 'PAID', closedAt: new Date() },
        });
        if (order.tableId) {
          await tx.posTable.update({ where: { id: order.tableId }, data: { currentOrderId: null } });
        }
      });
    }

    // A rejection must never become a completed payment. Void the pending
    // pay-later payment and the associated POS order. UNRESOLVED intentionally
    // remains pending until a reviewer makes a decision.
    if (status === 'REVERSED' && record.posOrderId) {
      await prisma.$transaction(async (tx) => {
        await tx.posPayment.updateMany({
          where: { orderId: record.posOrderId!, method: 'COMPLIMENTARY', status: 'PENDING' },
          data: { status: 'VOIDED' },
        });
        const confirmed = await tx.posPayment.aggregate({
          where: { orderId: record.posOrderId!, status: { in: ['CONFIRMED', 'PAID'] } },
          _sum: { amount: true },
        });
        const order = await tx.posOrder.findUnique({
          where: { id: record.posOrderId! },
          select: { notes: true },
        });
        const rejectionNote = `Complimentary request rejected${rejectionReason ? `: ${rejectionReason}` : ''}`;
        await tx.posOrder.update({
          where: { id: record.posOrderId! },
          data: {
            paymentStatus: Number(confirmed._sum.amount || 0) > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
            status: 'VOIDED',
            closedAt: null,
            notes: order?.notes ? `${order.notes}\n${rejectionNote}` : rejectionNote,
          },
        });
      });
    }

    return successResponse({ record });
  } catch (err: any) {
    console.error('[Complimentary PATCH]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

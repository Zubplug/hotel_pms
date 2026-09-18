import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/rbac';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string; paymentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { accountId, paymentId } = await params;
    const body = await req.json();
    const allocationId = String(body.allocationId || '');
    if (!allocationId) return errorResponse('BAD_REQUEST', 'Allocation id is required', 400);
    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId }, include: { property: true } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    const role = session.user.role || 'UNKNOWN';
    const allowed = ['ACCOUNTANT', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role) || await hasPermission(session.user.id, 'receivables', 'collect', account.propertyId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Insufficient permissions to unapply receivables cash.', 403);

    const result = await prisma.$transaction(async tx => {
      const allocation = await tx.cityLedgerAllocation.findUnique({ where: { id: allocationId }, include: { payment: true, invoice: true } });
      if (!allocation || allocation.paymentId !== paymentId || allocation.payment.accountId !== accountId || !allocation.invoice) throw new Error('ALLOCATION_NOT_FOUND');
      await tx.$queryRaw`SELECT id FROM "CityLedgerEntry" WHERE id = ${paymentId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "CityLedgerInvoice" WHERE id = ${allocation.invoice.id}::uuid FOR UPDATE`;
      const amount = Number(allocation.amount);
      const invoice = allocation.invoice;
      const outstanding = Number(invoice.outstandingAmount) + amount;
      await tx.cityLedgerInvoice.update({ where: { id: invoice.id }, data: { paidAmount: { decrement: amount }, outstandingAmount: outstanding, status: 'OPEN' } });
      await tx.cityLedgerAllocation.delete({ where: { id: allocationId } });
      await tx.cityLedgerEntry.update({ where: { id: paymentId }, data: { status: 'OPEN', reason: 'Payment unapplied; awaiting allocation' } });
      await tx.auditLog.create({ data: { organizationId: account.property.organizationId, propertyId: account.propertyId, userId: session.user.id, userEmail: session.user.email, userRole: role, action: 'AR_PAYMENT_UNAPPLIED', resource: 'CityLedgerEntry', resourceId: paymentId, newValue: { invoiceId: invoice.id, allocationId, amount }, ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1', userAgent: req.headers.get('user-agent') || 'Unknown', requestId: req.headers.get('x-request-id') || crypto.randomUUID() } });
      return { invoiceId: invoice.id, amount };
    });
    return successResponse({ unapplied: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to unapply payment';
    if (message === 'ALLOCATION_NOT_FOUND') return errorResponse('NOT_FOUND', 'Payment allocation was not found for this account.', 404);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

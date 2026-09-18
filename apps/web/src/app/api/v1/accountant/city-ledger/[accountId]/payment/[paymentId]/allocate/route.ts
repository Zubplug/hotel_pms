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
    const invoiceId = String(body.invoiceId || '');
    const amount = Number(body.amount || 0);
    if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return errorResponse('BAD_REQUEST', 'Invoice and positive allocation amount are required', 400);
    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId }, include: { property: true } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    const role = session.user.role || 'UNKNOWN';
    const allowed = ['ACCOUNTANT', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role) || await hasPermission(session.user.id, 'receivables', 'collect', account.propertyId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Insufficient permissions to allocate receivables cash.', 403);

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "CityLedgerEntry" WHERE id = ${paymentId}::uuid AND "accountId" = ${accountId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "CityLedgerInvoice" WHERE id = ${invoiceId}::uuid AND "accountId" = ${accountId}::uuid FOR UPDATE`;
      const payment = await tx.cityLedgerEntry.findUnique({ where: { id: paymentId } });
      const invoice = await tx.cityLedgerInvoice.findUnique({ where: { id: invoiceId } });
      if (!payment || payment.type !== 'PAYMENT' || payment.accountId !== accountId) throw new Error('PAYMENT_NOT_FOUND');
      if (!invoice || invoice.accountId !== accountId || ['PAID', 'VOID'].includes(invoice.status)) throw new Error('INVOICE_NOT_FOUND');
      const allocated = await tx.cityLedgerAllocation.aggregate({ where: { paymentId, invoiceId: { not: null } }, _sum: { amount: true } });
      const remainingPayment = Number(payment.amount) - Number(allocated._sum.amount || 0);
      if (payment.status !== 'OPEN' || remainingPayment <= 0.01) throw new Error('PAYMENT_NOT_AVAILABLE');
      if (amount > remainingPayment + 0.01) throw new Error('ALLOCATION_EXCEEDS_PAYMENT');
      if (amount > Number(invoice.outstandingAmount) + 0.01) throw new Error('ALLOCATION_EXCEEDS_INVOICE');
      const outstanding = Number(invoice.outstandingAmount) - amount;
      await tx.cityLedgerInvoice.update({ where: { id: invoiceId }, data: { paidAmount: { increment: amount }, outstandingAmount: outstanding, status: outstanding <= 0.01 ? 'PAID' : 'PARTIALLY_PAID' } });
      const allocation = await tx.cityLedgerAllocation.create({ data: { paymentId, invoiceId, amount, currency: payment.currency, createdBy: session.user.id } });
      if (remainingPayment - amount <= 0.01) await tx.cityLedgerEntry.update({ where: { id: paymentId }, data: { status: 'SETTLED', reason: 'Allocated city ledger payment' } });
      await tx.auditLog.create({ data: { organizationId: account.property.organizationId, propertyId: account.propertyId, userId: session.user.id, userEmail: session.user.email, userRole: role, action: 'AR_PAYMENT_ALLOCATED', resource: 'CityLedgerEntry', resourceId: paymentId, newValue: { invoiceId, amount, allocationId: allocation.id }, ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1', userAgent: req.headers.get('user-agent') || 'Unknown', requestId: req.headers.get('x-request-id') || crypto.randomUUID() } });
      return allocation;
    });
    return successResponse({ allocation: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to allocate payment';
    if (message === 'PAYMENT_NOT_FOUND' || message === 'INVOICE_NOT_FOUND') return errorResponse('NOT_FOUND', 'Payment or invoice was not found for this account.', 404);
    if (message === 'PAYMENT_NOT_AVAILABLE') return errorResponse('CONFLICT', 'Payment has no remaining unapplied amount.', 409);
    if (message === 'ALLOCATION_EXCEEDS_PAYMENT' || message === 'ALLOCATION_EXCEEDS_INVOICE') return errorResponse('BAD_REQUEST', 'Allocation exceeds the available payment or invoice balance.', 400);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

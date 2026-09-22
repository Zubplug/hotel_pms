import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import { GLMappingService } from '@/lib/services/gl-mapping-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import prisma from '@hotel-pms/db';

const ACCOUNTANT_ROLES = ['ACCOUNTANT', 'NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string; paymentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { accountId, paymentId } = await params;
    const body = await req.json();
    const allocationId = String(body.allocationId || '');
    const reason = String(body.reason || '').trim();
    if (!allocationId || reason.length < 3) return errorResponse('BAD_REQUEST', 'Allocation id and a clear audit reason are required', 400);
    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId }, include: { property: true } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    if (account.type !== 'CORPORATE') return errorResponse('INVALID_STATE', 'Only corporate receipts can be returned to unapplied advance status.', 409);
    const role = session.user.role || 'UNKNOWN';
    const allowed = ACCOUNTANT_ROLES.includes(String(role).toUpperCase());
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
      await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { decrement: amount } } });
      const cityLedgerAccountId = await GLMappingService.getCityLedgerAccount(account.propertyId);
      const advancesAccountId = await GLMappingService.getCorporateAdvancesAccount(account.propertyId);
      await GeneralLedgerService.postJournal({ userId: session.user.id, propertyIds: [account.propertyId], organizationId: account.property.organizationId, role, permissions: [], outletIds: [] }, {
        propertyId: account.propertyId,
        entryDate: account.property.businessDate || getPropertyBusinessDate(account.property.timezone),
        reference: `UNAPPLY-${paymentId.slice(0, 8)}-${allocationId.slice(0, 8)}`,
        description: 'Unapply city-ledger payment to unapplied corporate advance',
        sourceModule: 'AR',
        lines: [
          { accountId: cityLedgerAccountId, description: 'Restore city-ledger receivable', debit: amount, credit: 0, sourceType: 'AR_UNAPPLY', sourceId: allocationId },
          { accountId: advancesAccountId, description: 'Reclassify receipt as unapplied corporate advance', debit: 0, credit: amount, sourceType: 'AR_UNAPPLY', sourceId: allocationId },
        ],
      }, tx);
      await tx.cityLedgerEntry.update({ where: { id: paymentId }, data: { status: 'OPEN', reason: 'Payment unapplied; awaiting allocation' } });
      await tx.auditLog.create({ data: { organizationId: account.property.organizationId, propertyId: account.propertyId, userId: session.user.id, userEmail: session.user.email, userRole: role, action: 'AR_PAYMENT_UNAPPLIED', resource: 'CityLedgerEntry', resourceId: paymentId, newValue: { invoiceId: invoice.id, allocationId, amount, reason }, ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1', userAgent: req.headers.get('user-agent') || 'Unknown', requestId: req.headers.get('x-request-id') || crypto.randomUUID() } });
      return { invoiceId: invoice.id, amount };
    });
    return successResponse({ unapplied: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to unapply payment';
    if (message === 'ALLOCATION_NOT_FOUND') return errorResponse('NOT_FOUND', 'Payment allocation was not found for this account.', 404);
    if (message === 'INVALID_STATE') return errorResponse('CONFLICT', 'Only corporate receipts can be returned to unapplied advance status.', 409);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

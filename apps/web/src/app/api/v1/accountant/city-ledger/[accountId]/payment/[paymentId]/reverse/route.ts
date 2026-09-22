import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/rbac';
import { errorResponse, successResponse } from '@/lib/api-response';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import prisma from '@hotel-pms/db';

const ACCOUNTANT_ROLES = ['ACCOUNTANT', 'NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string; paymentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { accountId, paymentId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || '').trim();
    if (reason.length < 3) return errorResponse('BAD_REQUEST', 'A reversal reason is required.', 400);

    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId }, include: { property: true } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    const role = session.user.role || 'UNKNOWN';
    const allowed = ACCOUNTANT_ROLES.includes(role) || await hasPermission(session.user.id, 'receivables', 'collect', account.propertyId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Insufficient permissions to reverse receivables cash.', 403);

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "CityLedgerAccount" WHERE id = ${accountId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "CityLedgerEntry" WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const entry = await tx.cityLedgerEntry.findUnique({
        where: { id: paymentId },
        include: { allocations: { include: { invoice: true } } },
      });
      if (!entry || entry.accountId !== accountId || entry.type !== 'PAYMENT') throw new Error('PAYMENT_NOT_FOUND');
      if (entry.status === 'REVERSED') throw new Error('PAYMENT_ALREADY_REVERSED');

      const payment = await tx.payment.findFirst({ where: { propertyId: account.propertyId, collectionSource: 'RECEIVABLES', OR: [{ reference: entry.reference || undefined }, { receiptNumber: entry.reference || undefined }] }, orderBy: { createdAt: 'desc' } });
      if (!payment) throw new Error('PAYMENT_RECORD_NOT_FOUND');
      if (payment.status === 'REFUNDED') throw new Error('PAYMENT_ALREADY_REVERSED');
      const appliedAmount = entry.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);

      const journal = await tx.journalEntry.findFirst({
        where: { propertyId: account.propertyId, status: 'POSTED', lines: { some: { sourceType: 'PAYMENT', sourceId: payment.id } } },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!journal) throw new Error('PAYMENT_JOURNAL_NOT_FOUND');

      for (const allocation of entry.allocations) {
        if (allocation.invoice) {
          await tx.$queryRaw`SELECT id FROM "CityLedgerInvoice" WHERE id = ${allocation.invoice.id}::uuid FOR UPDATE`;
          const outstanding = Number(allocation.invoice.outstandingAmount) + Number(allocation.amount);
          await tx.cityLedgerInvoice.update({ where: { id: allocation.invoice.id }, data: { paidAmount: { decrement: Number(allocation.amount) }, outstandingAmount: outstanding, status: 'OPEN' } });
        }
        await tx.cityLedgerAllocation.delete({ where: { id: allocation.id } });
      }

      const reversalLines = journal.lines.map(line => ({
        accountId: line.accountId,
        debit: Number(line.credit),
        credit: Number(line.debit),
        description: `Reversal of ${journal.entryNumber}: ${line.description || ''}`,
        sourceType: 'PAYMENT_REVERSAL',
        sourceId: payment.id,
      }));
      const businessDate = account.property.businessDate || getPropertyBusinessDate(account.property.timezone);
      const reversal = await GeneralLedgerService.postJournal({ userId: session.user.id, propertyIds: [account.propertyId], organizationId: account.property.organizationId, role, permissions: [], outletIds: [] }, {
        propertyId: account.propertyId,
        entryDate: businessDate,
        reference: `REV-${payment.receiptNumber || payment.id.slice(0, 8)}`,
        description: `Reverse AR payment: ${reason}`,
        sourceModule: 'AR_REVERSAL',
        lines: reversalLines,
      }, tx);

      await tx.journalEntry.update({ where: { id: journal.id }, data: { status: 'REVERSED', isReversed: true, reversalOfId: reversal.id } });
      await tx.cityLedgerEntry.update({ where: { id: entry.id }, data: { status: 'REVERSED', reason: `Payment reversed: ${reason}` } });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED', notes: `${payment.notes || 'AR collection'} · Reversed: ${reason}` } });
      if (appliedAmount > 0.01) await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { increment: appliedAmount } } });
      if (payment.folioId) await tx.folio.update({ where: { id: payment.folioId }, data: { totalPayments: { decrement: Number(entry.amount) }, balance: { increment: Number(entry.amount) } } });
      await tx.auditLog.create({ data: { organizationId: account.property.organizationId, propertyId: account.propertyId, userId: session.user.id, userEmail: session.user.email, userRole: role, action: 'AR_PAYMENT_REVERSED', resource: 'CityLedgerEntry', resourceId: entry.id, newValue: { reason, paymentId: payment.id, originalJournalId: journal.id, reversalJournalId: reversal.id }, ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1', userAgent: req.headers.get('user-agent') || 'Unknown', requestId: req.headers.get('x-request-id') || crypto.randomUUID() } });
      return { paymentId: payment.id, entryId: entry.id, reversalJournalId: reversal.id };
    });
    return successResponse(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to reverse payment';
    if (['PAYMENT_NOT_FOUND', 'PAYMENT_RECORD_NOT_FOUND', 'PAYMENT_JOURNAL_NOT_FOUND'].includes(message)) return errorResponse('NOT_FOUND', 'The payment cannot be reversed because its accounting record is incomplete.', 404);
    if (message === 'PAYMENT_ALREADY_REVERSED') return errorResponse('CONFLICT', 'This payment has already been reversed.', 409);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import { GLMappingService } from '@/lib/services/gl-mapping-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const accountId = String(body.accountId || '');
    const invoiceNumber = String(body.invoiceNumber || '').trim();
    const amount = Number(body.amount || 0);
    const issueDate = new Date(`${String(body.issueDate || '')}T00:00:00.000Z`);
    const dueDate = new Date(`${String(body.dueDate || '')}T00:00:00.000Z`);
    const description = String(body.description || '').trim();
    if (!accountId || !invoiceNumber || !Number.isFinite(amount) || amount <= 0 || !description || Number.isNaN(issueDate.getTime()) || Number.isNaN(dueDate.getTime()) || dueDate < issueDate) {
      return errorResponse('BAD_REQUEST', 'Account, invoice number, valid issue/due dates, positive amount, and description are required', 400);
    }

    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    if (account.status !== 'ACTIVE') return errorResponse('INVALID_STATE', 'City ledger account is not active', 409);
    const existingInvoice = await prisma.cityLedgerInvoice.findUnique({ where: { propertyId_invoiceNumber: { propertyId: account.propertyId, invoiceNumber } } });
    if (existingInvoice) return errorResponse('DUPLICATE_INVOICE_NUMBER', 'Invoice number already exists for this property', 409);
    const cityLedgerAccountId = await GLMappingService.getCityLedgerAccount(account.propertyId);
    const revenueAccountId = await GLMappingService.getOtherRevenueAccount(account.propertyId);
    const businessDate = getPropertyBusinessDate((await prisma.property.findUniqueOrThrow({ where: { id: account.propertyId }, select: { timezone: true } })).timezone);

    const result = await prisma.$transaction(async tx => {
      const invoice = await tx.cityLedgerInvoice.create({
        data: {
          propertyId: account.propertyId,
          accountId,
          invoiceNumber,
          issueDate,
          dueDate,
          description,
          amount,
          outstandingAmount: amount,
          currency: account.currency,
          createdBy: session.user.id,
        }
      });
      const created = await tx.cityLedgerEntry.create({
        data: {
          accountId,
          propertyId: account.propertyId,
          amount,
          currency: account.currency,
          type: 'TRANSFER_IN',
          status: 'OPEN',
          invoiceId: invoice.id,
          reference: invoiceNumber,
          reason: description,
          createdBy: session.user.id,
        },
      });
      await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } });
      await GeneralLedgerService.postJournal(
        { userId: session.user.id, propertyIds: [account.propertyId], organizationId: account.organizationId, role: session.user.role || 'UNKNOWN', permissions: [], outletIds: [] },
        { propertyId: account.propertyId, entryDate: issueDate || businessDate, reference: invoiceNumber, description: `Manual AR invoice ${invoiceNumber}`, sourceModule: 'AR', lines: [
          { accountId: cityLedgerAccountId, description: 'Manual city-ledger invoice', debit: amount, credit: 0, sourceType: 'CITY_LEDGER_INVOICE', sourceId: invoice.id },
          { accountId: revenueAccountId, description: description, debit: 0, credit: amount, sourceType: 'CITY_LEDGER_INVOICE', sourceId: invoice.id },
        ] }, tx,
      );
      return { invoice, entry: created };
    });

    return successResponse(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to create city ledger debit';
    console.error('[City Ledger Invoice POST]', error);
    if (message.includes('GL Account') || message.includes('No open accounting period')) return errorResponse('ACCOUNTING_CONFIGURATION_REQUIRED', message, 409);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

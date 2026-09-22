import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/rbac';
import { errorResponse, successResponse } from '@/lib/api-response';
import { GLMappingService } from '@/lib/services/gl-mapping-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import prisma, { PaymentMethod } from '@hotel-pms/db';

const ALLOWED_METHODS = ['CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'CARD_OFFLINE', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT', 'CHEQUE', 'OTHER'];
const FRONT_DESK_ROLES = ['FRONT_DESK', 'FRONT_DESK_MANAGER', 'RECEPTIONIST'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { accountId } = await params;
    const body = await req.json();
    const amount = Number(body.amount || 0);
    const reference = String(body.reference || '').trim();
    const method = body.method;
    const invoiceId = body.invoiceId; // optional
    const frontdeskSessionId = body.frontdeskSessionId ? String(body.frontdeskSessionId) : undefined;
    const idempotencyKey = body.idempotencyKey;

    if (!idempotencyKey) return errorResponse('BAD_REQUEST', 'idempotencyKey is required', 400);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse('BAD_REQUEST', 'Positive amount is required', 400);
    if (!ALLOWED_METHODS.includes(method)) return errorResponse('BAD_REQUEST', `Invalid payment method. Allowed: ${ALLOWED_METHODS.join(', ')}`, 400);

    const ctx = await requireOrganizationContext(session.user.id);
    const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId }, include: { property: true } });
    if (!account || !ctx.propertyIds.includes(account.propertyId)) return errorResponse('FORBIDDEN', 'City ledger account is not accessible', 403);
    if (frontdeskSessionId) {
      const frontdeskSession = await prisma.frontdeskSession.findUnique({ where: { id: frontdeskSessionId }, select: { propertyId: true, staffId: true, status: true, controlStatus: true } });
      if (!frontdeskSession || frontdeskSession.propertyId !== account.propertyId || frontdeskSession.staffId !== session.user.id || frontdeskSession.status !== 'OPEN' || frontdeskSession.controlStatus !== 'OPEN') return errorResponse('INVALID_STATE', 'Front Desk shift is not open for this payment', 409);
    }
    if (account.status !== 'ACTIVE') return errorResponse('INVALID_STATE', 'City ledger account is not active', 409);

    // Permission enforcement
    const userRole = session.user.role || 'UNKNOWN';
    const isAccountant = ['ACCOUNTANT', 'NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);
    const canCollect = Boolean(frontdeskSessionId && FRONT_DESK_ROLES.includes(String(userRole).toUpperCase())) || isAccountant || await hasPermission(session.user.id, 'receivables', 'collect', account.propertyId);
    
    if (!canCollect) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to post receivables collections.', 403);
    }
    if (!frontdeskSessionId) return errorResponse('FORBIDDEN', 'City-ledger settlement must be posted from an open Front Desk shift.', 403);

    // Resolve the posting accounts before changing any subledger state. A
    // missing or inactive mapping must block the entire settlement.
    const debitAccountId = await GLMappingService.getAssetAccountForMethod(account.propertyId, method);
    const cityLedgerControlAccountId = await GLMappingService.getCityLedgerAccount(account.propertyId);
    const businessDate = account.property.businessDate || getPropertyBusinessDate(account.property.timezone);

    if (account.type === 'SKIPPER' && !invoiceId) {
      return errorResponse('BAD_REQUEST', 'Skipper accounts require a specific invoiceId to be settled individually.', 400);
    }

    const entry = await prisma.$transaction(async tx => {
      // 1. Idempotency Check - Return existing if same parameters
      const existingPayment = await tx.payment.findUnique({ where: { idempotencyKey } });
      if (existingPayment) {
        // Return success if it matches this exact operation intention
        if (Number(existingPayment.amount) === amount && existingPayment.method === method) {
          const existingEntry = await tx.cityLedgerEntry.findFirst({
            where: { reference: reference || existingPayment.receiptNumber, accountId, type: 'PAYMENT' }
          });
          return existingEntry || { idempotencyKey, status: 'ALREADY_PROCESSED' };
        }
        throw new Error('IDEMPOTENCY_CONFLICT');
      }

      // 2. Lock account
      await tx.$queryRaw`SELECT balance FROM "CityLedgerAccount" WHERE id = ${accountId}::uuid FOR UPDATE`;

      // 3. Invoice validation
      let invoicesToPay = [];
      if (invoiceId) {
        const inv = await tx.cityLedgerInvoice.findUnique({ where: { id: invoiceId } });
        if (!inv || inv.accountId !== accountId) throw new Error('INVOICE_NOT_FOUND');
        if (['PAID', 'VOID'].includes(inv.status)) throw new Error('INVOICE_ALREADY_PAID');
        if (amount > Number(inv.outstandingAmount)) throw new Error('PAYMENT_EXCEEDS_INVOICE_BALANCE');
        invoicesToPay.push(inv);
      } else {
        invoicesToPay = await tx.cityLedgerInvoice.findMany({
          where: { accountId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, outstandingAmount: { gt: 0 } },
          orderBy: [{ dueDate: 'asc' }, { issueDate: 'asc' }]
        });
        const totalOutstanding = invoicesToPay.reduce((sum, inv) => sum + Number(inv.outstandingAmount), 0);
        // Corporate receipts may exceed the open invoice portfolio. The
        // applied portion settles AR; the remainder stays as an unapplied
        // customer advance instead of creating a negative AR balance.
        if (amount > totalOutstanding && account.type !== 'CORPORATE') {
          throw new Error('PAYMENT_EXCEEDS_BALANCE');
        }
      }

      // 4. Find or create Master CITY_LEDGER folio for AR Collections
      let masterFolio = await tx.folio.findFirst({
        where: { propertyId: account.propertyId, type: 'CITY_LEDGER', corporateAccountId: null, reservationId: null, status: 'OPEN' }
      });
      if (!masterFolio) {
        masterFolio = await tx.folio.create({
          data: {
            propertyId: account.propertyId,
            type: 'CITY_LEDGER',
            status: 'OPEN',
            currency: account.currency,
            folioNumber: `AR-${account.propertyId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`
          }
        });
      }

      // 5. Create Payment record for Hotel Ledger (Assets: Cash/Bank)
      const year = new Date().getFullYear();
      const randomPart = crypto.randomUUID().split('-')[0].toUpperCase().slice(0, 6);
      const receiptNumber = `RCPT-${year}-${randomPart}`;
      
      const payment = await tx.payment.create({
        data: {
          folioId: masterFolio.id,
          propertyId: account.propertyId,
          method: method as PaymentMethod,
          collectionSource: 'RECEIVABLES',
          frontdeskSessionId,
          amount,
          currency: account.currency,
          baseAmount: amount,
          status: 'COMPLETED',
          businessDate,
          idempotencyKey,
          receiptNumber,
          reference: reference || undefined,
          receivedBy: session.user.id,
          notes: invoiceId
            ? `AR Collection for Invoice ${invoiceId}`
            : invoicesToPay.length
              ? 'Bulk AR Collection'
              : 'Unapplied corporate advance'
        }
      });

      // 6. Create CityLedgerEntry for AR Ledger (Assets: AR Decrease)
      const created = await tx.cityLedgerEntry.create({
        data: {
          accountId,
          propertyId: account.propertyId,
          amount,
          currency: account.currency,
          type: 'PAYMENT',
          status: 'OPEN', // Will be SETTLED if fully allocated below
          reference: reference || payment.receiptNumber,
          reason: invoiceId
            ? `Settlement for specific invoice`
            : invoicesToPay.length
              ? 'Bulk city ledger payment'
              : 'Unapplied corporate advance',
          createdBy: session.user.id,
        },
      });

      // 7. Allocate to invoices, retaining any corporate excess as unapplied.
      let remaining = amount;
      for (const invoice of invoicesToPay) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, Number(invoice.outstandingAmount));
        const outstandingAmount = Number(invoice.outstandingAmount) - applied;
        
        await tx.cityLedgerInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: { increment: applied },
            outstandingAmount,
            status: outstandingAmount <= 0.01 ? 'PAID' : 'PARTIALLY_PAID'
          }
        });
        
        await tx.cityLedgerAllocation.create({
          data: {
            paymentId: created.id,
            invoiceId: invoice.id,
            amount: applied,
            currency: account.currency,
            createdBy: session.user.id
          }
        });
        
        if (outstandingAmount <= 0.01) {
          await tx.cityLedgerEntry.updateMany({
            where: { invoiceId: invoice.id, type: 'TRANSFER_IN', status: 'OPEN' },
            data: { status: 'SETTLED' }
          });
        }
        remaining -= applied;
      }
      
      const appliedAmount = amount - remaining;
      const corporateAdvancesAccountId = remaining > 0.01 && account.type === 'CORPORATE'
        ? await GLMappingService.getCorporateAdvancesAccount(account.propertyId)
        : null;
      if (remaining <= 0.01) {
        await tx.cityLedgerEntry.update({
          where: { id: created.id },
          data: { status: 'SETTLED', reason: 'Matched city ledger payment' }
        });
      }
      
      // 8. Update Account Balance
      if (appliedAmount > 0.01) {
        await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { decrement: appliedAmount } } });
      }

      // Keep the master AR folio summary aligned with its payment records.
      await tx.folio.update({
        where: { id: masterFolio.id },
        data: { totalPayments: { increment: amount }, balance: { decrement: amount } },
      });

      // 8.5 Post the controlled double-entry AR settlement. This validates
      // the accounting period and rolls back the complete transaction if GL
      // posting fails.
      await GeneralLedgerService.postJournal(
        {
          userId: session.user.id,
          propertyIds: [account.propertyId],
          organizationId: account.property.organizationId,
          role: userRole,
          permissions: [],
          outletIds: [],
        },
        {
          propertyId: account.propertyId,
          entryDate: businessDate,
          reference: payment.receiptNumber || undefined,
          description: payment.notes || 'AR Payment Collection',
          sourceModule: 'AR',
          lines: [
            { accountId: debitAccountId, description: `Payment Received (${method})`, debit: amount, credit: 0, sourceType: 'PAYMENT', sourceId: payment.id },
            ...(appliedAmount > 0.01 ? [{ accountId: cityLedgerControlAccountId, description: 'AR Payment Collection', debit: 0, credit: appliedAmount, sourceType: 'PAYMENT', sourceId: payment.id }] : []),
            ...(remaining > 0.01 && corporateAdvancesAccountId ? [{ accountId: corporateAdvancesAccountId, description: 'Unapplied corporate advance', debit: 0, credit: remaining, sourceType: 'PAYMENT', sourceId: payment.id }] : []),
          ],
        },
        tx,
      );

      // 9. Audit Trail
      await tx.auditLog.create({
        data: {
          organizationId: account.property.organizationId,
          propertyId: account.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: userRole,
          action: 'AR_PAYMENT_POSTED',
          resource: 'CityLedgerAccount',
          resourceId: account.id,
          newValue: {
            amount,
            method,
            reference,
            invoiceId,
            paymentId: payment.id,
            entryId: created.id,
            idempotencyKey
          },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        }
      });

      return created;
    });

    return successResponse({ entry });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to record city ledger payment';
    const errorCode = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
    const errorMeta = error && typeof error === 'object' && 'meta' in error ? (error as { meta?: { target?: unknown } }).meta : undefined;
    if (message === 'IDEMPOTENCY_CONFLICT') return errorResponse('CONFLICT', 'A different payment with this idempotency key already exists.', 409);
    if (message === 'INVOICE_NOT_FOUND') return errorResponse('NOT_FOUND', 'Target invoice not found in this account.', 404);
    if (message === 'INVOICE_ALREADY_PAID') return errorResponse('CONFLICT', 'Target invoice is already paid.', 409);
    if (message === 'PAYMENT_EXCEEDS_INVOICE_BALANCE') return errorResponse('BAD_REQUEST', 'Payment exceeds outstanding invoice balance.', 400);
    if (message === 'PAYMENT_EXCEEDS_BALANCE') return errorResponse('PAYMENT_EXCEEDS_BALANCE', 'Payment cannot exceed the outstanding city ledger balance', 409);
    if (message.includes('Required GL Account') || message.includes('GL Account') || message.includes('No open accounting period')) {
      return errorResponse('ACCOUNTING_CONFIGURATION_REQUIRED', message, 409);
    }
    
    // Catch Prisma P2002 explicitly just in case race condition hits between `findUnique` and `create`
    if (errorCode === 'P2002' && String(errorMeta?.target || '').includes('idempotencyKey')) {
      return errorResponse('CONFLICT', 'A payment with this operation ID is already processing.', 409);
    }
    
    console.error('[City Ledger Payment POST]', error);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

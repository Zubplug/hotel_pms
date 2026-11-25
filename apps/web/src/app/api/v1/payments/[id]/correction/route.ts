import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { hasPermission } from '@/lib/rbac';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { isConcessionManagementPosition } from '@/lib/concession-accountability';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { FolioPaymentAccountingService } from '@/lib/services/folio-payment-accounting-service';

const METHODS = ['CASH', 'POS', 'BANK_TRANSFER', 'CARD'] as const;

function isMethod(value: unknown): value is (typeof METHODS)[number] {
  return typeof value === 'string' && (METHODS as readonly string[]).includes(value);
}

async function managerForProperty(userId: string, propertyId: string) {
  const staff = await prisma.staff.findFirst({
    where: { userId, propertyAccess: { has: propertyId }, isActive: true },
    select: { id: true, position: true },
  });
  return staff && isConcessionManagementPosition(staff.position) ? staff : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id: paymentId } = await params;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, propertyId: true } });
    if (!payment) return errorResponse('NOT_FOUND', 'Payment not found', 404);
    await assertPropertyAccess(session.user.id, payment.propertyId);
    const correction = await prisma.paymentCorrection.findUnique({ where: { originalPaymentId: payment.id } });
    if (!correction) return successResponse({ correction: null, canApprove: false });
    const manager = await managerForProperty(session.user.id, correction.propertyId);
    return successResponse({
      correction,
      canApprove: Boolean(manager && correction.requestedById !== session.user.id && correction.status === 'REQUESTED'),
    });
  } catch (error) {
    console.error('[Payment correction lookup]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load payment correction', 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id: paymentId } = await params;
    const body = await req.json();
    const correctedMethod = body?.correctedMethod;
    const correctedAmount = Number(body?.correctedAmount);
    const reason = String(body?.reason || '').trim();
    const idempotencyKey = String(body?.idempotencyKey || '').trim();
    const supportingReference = String(body?.supportingReference || '').trim() || null;

    if ((correctedMethod !== undefined && correctedMethod !== '' && !isMethod(correctedMethod)) || !Number.isFinite(correctedAmount) || correctedAmount <= 0 || reason.length < 10 || !idempotencyKey) {
      return errorResponse('BAD_REQUEST', 'A valid corrected amount, an optional corrected method, a reason of at least 10 characters, and an idempotency key are required.', 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { folio: true, property: true, frontdeskSession: true, refunds: true, refundRequests: true },
    });
    if (!payment) return errorResponse('NOT_FOUND', 'Payment not found', 404);
    await assertPropertyAccess(session.user.id, payment.propertyId);
    if (!(await hasPermission(session.user.id, 'reservation', 'update', payment.propertyId))) {
      return errorResponse('FORBIDDEN', 'You do not have permission to request a payment correction.', 403);
    }
    if (payment.status !== 'COMPLETED') return errorResponse('CONFLICT', 'Only completed payments can be corrected.', 409);
    const nextMethod = correctedMethod || payment.method;
    if (payment.method === nextMethod && Math.abs(Number(payment.amount) - correctedAmount) < 0.005) return errorResponse('BAD_REQUEST', 'The payment method and amount are unchanged.', 400);
    if (payment.folio.status === 'CLOSED') return errorResponse('CONFLICT', 'This folio is closed.', 409);
    if (payment.refunds.length || payment.refundRequests.some((item) => ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'].includes(item.status))) {
      return errorResponse('CONFLICT', 'A refunded or refund-pending payment cannot be corrected.', 409);
    }
    if (await isNightAuditTransactionLocked(payment.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Payment corrections are locked during Night Audit.', 409);
    }
    if (payment.frontdeskSession && (payment.frontdeskSession.status !== 'OPEN' || payment.frontdeskSession.controlStatus !== 'OPEN')) {
      return errorResponse('CONFLICT', 'This correction must be requested before the Front Desk shift is closed.', 409);
    }

    const existing = await prisma.paymentCorrection.findUnique({ where: { originalPaymentId: payment.id } });
    if (existing) return successResponse(existing, 200);

    const correction = await prisma.paymentCorrection.create({
      data: {
        propertyId: payment.propertyId,
        originalPaymentId: payment.id,
        originalMethod: payment.method,
        correctedMethod: nextMethod,
        amount: payment.amount,
        correctedAmount,
        currency: payment.currency,
        reason,
        supportingReference,
        requestedById: session.user.id,
        idempotencyKey,
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId: payment.property.organizationId,
        propertyId: payment.propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: (session.user as any).role || 'STAFF',
        action: 'PAYMENT_CORRECTION_REQUESTED',
        resource: 'Payment',
        resourceId: payment.id,
        newValue: { correctionId: correction.id, from: payment.method, to: nextMethod, originalAmount: payment.amount, correctedAmount, reason },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: req.headers.get('x-request-id') || randomUUID(),
      },
    });
    return successResponse(correction, 201);
  } catch (error: any) {
    if (error?.code === 'P2002') return errorResponse('CONFLICT', 'A correction request already exists for this payment.', 409);
    console.error('[Payment correction request]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to request payment correction', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id: correctionId } = await params;
    const body = await req.json().catch(() => ({}));
    const decision = body?.decision;
    const reason = String(body?.reason || '').trim();
    const correction = await prisma.paymentCorrection.findUnique({ where: { id: correctionId } });
    if (!correction) return errorResponse('NOT_FOUND', 'Payment correction not found', 404);
    await assertPropertyAccess(session.user.id, correction.propertyId);
    if (correction.requestedById === session.user.id) return errorResponse('FORBIDDEN', 'The requester cannot approve their own correction.', 403);
    if (decision === 'REJECT') {
      const manager = await managerForProperty(session.user.id, correction.propertyId);
      if (!manager || reason.length < 10) return errorResponse('FORBIDDEN', 'A manager and rejection reason are required.', 403);
      const rejected = await prisma.paymentCorrection.updateMany({ where: { id: correction.id, status: 'REQUESTED' }, data: { status: 'REJECTED', rejectedById: session.user.id, rejectionReason: reason } });
      if (rejected.count !== 1) return errorResponse('CONFLICT', 'This correction has already been decided.', 409);
      const property = await prisma.property.findUnique({ where: { id: correction.propertyId }, select: { organizationId: true } });
      if (property) {
        await prisma.auditLog.create({
          data: {
            organizationId: property.organizationId,
            propertyId: correction.propertyId,
            userId: session.user.id,
            userEmail: session.user.email,
            userRole: (session.user as any).role || 'MANAGER',
            action: 'PAYMENT_CORRECTION_REJECTED',
            resource: 'Payment',
            resourceId: correction.originalPaymentId,
            newValue: { correctionId: correction.id, reason },
            requestId: req.headers.get('x-request-id') || randomUUID(),
          },
        });
      }
      return successResponse(await prisma.paymentCorrection.findUnique({ where: { id: correction.id } }));
    }
    if (decision !== 'APPROVE') return errorResponse('BAD_REQUEST', 'Decision must be APPROVE or REJECT.', 400);
    const manager = await managerForProperty(session.user.id, correction.propertyId);
    if (!manager) return errorResponse('FORBIDDEN', 'Only an authorized manager or finance operator can approve corrections.', 403);
    if (await isNightAuditTransactionLocked(correction.propertyId)) return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Payment corrections are locked during Night Audit.', 409);

    const result = await prisma.$transaction(async (tx: any) => {
      const locked = await tx.paymentCorrection.findUnique({ where: { id: correction.id } });
      if (!locked || locked.status !== 'REQUESTED') throw new Error('CORRECTION_ALREADY_DECIDED');
      const payment = await tx.payment.findUnique({ where: { id: locked.originalPaymentId }, include: { folio: true, property: true, frontdeskSession: true, refunds: true } });
      if (!payment || payment.status !== 'COMPLETED') throw new Error('PAYMENT_NOT_CORRECTABLE');
      if (payment.folio.status === 'CLOSED' || payment.refunds.length) throw new Error('PAYMENT_NOT_CORRECTABLE');
      if (payment.frontdeskSession && (payment.frontdeskSession.status !== 'OPEN' || payment.frontdeskSession.controlStatus !== 'OPEN')) throw new Error('PAYMENT_NOT_CORRECTABLE');
      const sourceLine = await tx.journalEntryLine.findFirst({ where: { sourceType: 'PAYMENT', sourceId: payment.id, entry: { status: 'POSTED' } }, include: { entry: true }, orderBy: { entry: { createdAt: 'desc' } } });
      if (!sourceLine) throw new Error('PAYMENT_JOURNAL_NOT_FOUND');
      const property = payment.property;
      const tenant = { userId: session.user.id, propertyIds: [property.id], organizationId: property.organizationId, role: 'MANAGER', permissions: [], outletIds: [] } as any;
      const reversal = await GeneralLedgerService.reverseJournal(tenant, sourceLine.entry.id, payment.businessDate, `Payment method correction ${locked.id}`, tx);
      const replacement = await tx.payment.create({
        data: {
          folioId: payment.folioId,
          reservationId: payment.reservationId,
          eventInvoiceId: payment.eventInvoiceId,
          propertyId: payment.propertyId,
          method: locked.correctedMethod as any,
          collectionSource: payment.collectionSource,
          provider: payment.provider,
          providerTransactionId: payment.providerTransactionId,
          providerRef: payment.providerRef,
          terminalId: payment.terminalId,
          reference: locked.supportingReference || payment.reference,
          authorizationCode: payment.authorizationCode,
          amount: locked.correctedAmount,
          currency: payment.currency,
          baseAmount: locked.correctedAmount,
          exchangeRate: payment.exchangeRate,
          status: 'COMPLETED',
          businessDate: payment.businessDate,
          idempotencyKey: `PAYMENT_CORRECTION:${locked.id}`,
          receiptNumber: `RCPT-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
          receivedBy: session.user.id,
          frontdeskSessionId: payment.frontdeskSessionId,
          notes: `Replacement for corrected payment ${payment.id}. ${locked.reason}`,
        },
      });
      await FolioPaymentAccountingService.processPaymentAccounting(tx, replacement, payment.propertyId, property.organizationId, session.user.id);
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REVERSED', notes: `${payment.notes || ''}\nCorrected by ${locked.id}: ${locked.reason}`.trim() } });
      // Payment corrections change the payment collection without changing
      // the guest balance. Touch the folio so incremental desktop sync pulls
      // the reversed original and corrected replacement payment.
      const amountDelta = Number(locked.correctedAmount) - Number(payment.amount);
      await tx.folio.update({
        where: { id: payment.folioId },
        data: { totalPayments: { increment: amountDelta }, balance: { decrement: amountDelta }, updatedAt: new Date(), version: { increment: 1 } },
      });

      if (payment.frontdeskSessionId && (payment.method === 'CASH' || locked.correctedMethod === 'CASH')) {
        const cashSession = await tx.frontdeskSession.findUnique({ where: { id: payment.frontdeskSessionId } });
        if (cashSession) {
          const cashDelta = (locked.correctedMethod === 'CASH' ? Number(locked.correctedAmount) : 0) - (payment.method === 'CASH' ? Number(payment.amount) : 0);
          if (cashDelta !== 0) {
            await tx.cashAccount.update({ where: { id: cashSession.cashAccountId }, data: { balance: { increment: cashDelta } } });
            await tx.posCashMovement.create({ data: { propertyId: payment.propertyId, deviceId: payment.terminalId || 'FRONT_DESK', frontdeskSessionId: payment.frontdeskSessionId, userId: session.user.id, amount: cashDelta, currency: payment.currency, type: 'ADJUSTMENT', sourceAccountId: cashSession.cashAccountId, destinationAccountId: cashSession.cashAccountId, reasonCode: 'PAYMENT_CORRECTION', notes: `Correction ${locked.id}: ${payment.method} ${payment.amount} -> ${locked.correctedMethod} ${locked.correctedAmount}`, receiptReference: replacement.receiptNumber, operationId: `PAYMENT_CORRECTION_CASH:${locked.id}`, businessDate: cashSession.businessDate, authorizedBy: session.user.id } });
          }
        }
      }
      await tx.paymentCorrection.update({ where: { id: locked.id }, data: { status: 'POSTED', approvedById: session.user.id, approvedAt: new Date(), postedAt: new Date(), originalJournalId: sourceLine.entry.id, reversalJournalId: reversal.id, replacementPaymentId: replacement.id, replacementJournalId: (await tx.journalEntryLine.findFirst({ where: { sourceType: 'PAYMENT', sourceId: replacement.id }, select: { entryId: true } }))?.entryId } });
      await tx.auditLog.create({ data: { organizationId: property.organizationId, propertyId: property.id, userId: session.user.id, userEmail: session.user.email, userRole: (session.user as any).role || 'MANAGER', action: 'PAYMENT_CORRECTION_POSTED', resource: 'Payment', resourceId: payment.id, newValue: { correctionId: locked.id, replacementPaymentId: replacement.id, from: payment.method, to: locked.correctedMethod, originalAmount: payment.amount, correctedAmount: locked.correctedAmount }, requestId: req.headers.get('x-request-id') || randomUUID() } });
      return tx.paymentCorrection.findUnique({ where: { id: locked.id } });
    });
    return successResponse(result);
  } catch (error: any) {
    const message = error?.message || '';
    if (message === 'CORRECTION_ALREADY_DECIDED') return errorResponse('CONFLICT', 'This correction has already been decided.', 409);
    if (message === 'PAYMENT_NOT_CORRECTABLE' || message === 'PAYMENT_JOURNAL_NOT_FOUND') return errorResponse('CONFLICT', 'This payment can no longer be corrected.', 409);
    console.error('[Payment correction approval]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to post payment correction', 500);
  }
}

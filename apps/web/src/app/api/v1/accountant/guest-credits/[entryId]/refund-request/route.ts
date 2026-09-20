import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import { encrypt } from '@/lib/encryption';

const ACTIVE = ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!(session.user as any).capabilities?.includes('ACCESS_REFUNDS')) return errorResponse('FORBIDDEN', 'Refund permission is required.', 403);
    const { entryId } = await params;
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const requestedMethod = String(body.refundMethod || 'ORIGINAL_PAYMENT').toUpperCase();
    const reason = String(body.reason || '').trim();
    const idempotencyKey = String(body.idempotencyKey || '').trim() || `guest-credit-refund:${entryId}:${crypto.randomUUID()}`;
    const bankAccountName = String(body.bankAccountName || '').trim();
    const bankAccountNumber = String(body.bankAccountNumber || '').replace(/\s+/g, '');
    const bankName = String(body.bankName || '').trim();
    const bankCode = String(body.bankCode || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !reason || !['CASH', 'BANK_TRANSFER', 'ORIGINAL_PAYMENT'].includes(requestedMethod)) return errorResponse('BAD_REQUEST', 'Amount, reason, and a valid refund method are required.', 400);
    if (requestedMethod === 'BANK_TRANSFER' && (!bankAccountName || !/^\d{6,20}$/.test(bankAccountNumber) || !bankName)) return errorResponse('BAD_REQUEST', 'Bank name, account name, and a valid account number are required.', 400);

    const ctx = await requireOrganizationContext(session.user.id);
    const result = await prisma.$transaction(async tx => {
      const entry = await tx.cityLedgerEntry.findUnique({ where: { id: entryId }, include: { account: true, folio: { include: { property: true } }, reservation: true, allocations: true } });
      if (!entry || entry.type !== 'REFUND_OWED' || !entry.folio || !entry.guestId || !ctx.propertyIds.includes(entry.propertyId)) throw new Error('NOT_FOUND');
      if (entry.account.type !== 'REFUND_PAYABLE') throw new Error('INVALID_CREDIT_ACCOUNT');
      const payment = await tx.payment.findFirst({ where: { folioId: entry.folioId!, status: 'COMPLETED' }, orderBy: { createdAt: 'asc' } });
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      const allocated = entry.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
      const available = Number(entry.amount) - allocated;
      const pending = await tx.refundRequest.aggregate({ where: { cityLedgerEntryId: entry.id, status: { in: ACTIVE as any } }, _sum: { requestedAmount: true } });
      if (Number(pending._sum.requestedAmount || 0) + amount > available + 0.01) throw new Error('CREDIT_LIMIT_EXCEEDED');
      const existing = await tx.refundRequest.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      const rules = await tx.refundApprovalRule.findMany({ where: { propertyId: entry.propertyId, isActive: true }, orderBy: { stepOrder: 'asc' } });
      const matchingRules = rules.filter(rule => (rule.minAmount == null || amount >= Number(rule.minAmount)) && (rule.maxAmount == null || amount <= Number(rule.maxAmount)));
      const firstRule = matchingRules[0];
      const fallbackRoleName = amount > 250000 ? 'FINANCE_MANAGER' : amount > 50000 ? 'MANAGER' : 'FRONT_DESK_MANAGER';
      const role = firstRule?.roleId ? await tx.role.findUnique({ where: { id: firstRule.roleId } }) : await tx.role.findFirst({ where: { organizationId: entry.folio!.property.organizationId, name: fallbackRoleName } });
      const candidate = firstRule?.approverId ? { userId: firstRule.approverId } : role ? await tx.userRole.findFirst({ where: { roleId: role.id, userId: { not: session.user.id }, OR: [{ propertyId: entry.propertyId }, { propertyId: null }] }, select: { userId: true } }) : null;
      const request = await tx.refundRequest.create({ data: { organizationId: entry.folio.property.organizationId, propertyId: entry.propertyId, reservationId: entry.reservationId, folioId: entry.folioId!, paymentId: payment.id, guestId: entry.guestId, cityLedgerEntryId: entry.id, requestedAmount: amount, currency: entry.currency, requestedMethod, bankAccountName: requestedMethod === 'BANK_TRANSFER' ? bankAccountName : null, bankAccountNumberEncrypted: requestedMethod === 'BANK_TRANSFER' ? encrypt(bankAccountNumber) : null, bankAccountLast4: requestedMethod === 'BANK_TRANSFER' ? bankAccountNumber.slice(-4) : null, bankName: requestedMethod === 'BANK_TRANSFER' ? bankName : null, bankCode: requestedMethod === 'BANK_TRANSFER' ? bankCode || null : null, category: 'FOLIO_CREDIT_BALANCE', reason, supportingNotes: `Guest credit entry: ${entry.id}`, requestedById: session.user.id, currentApproverId: candidate?.userId, approvalRoleId: role?.id, currentApprovalStep: firstRule?.stepOrder || 1, idempotencyKey, expiresAt: new Date(Date.now() + 7 * 86400000) } });
      await tx.approvalRequest.create({ data: { propertyId: entry.propertyId, type: 'REFUND', status: 'PENDING', requestedBy: session.user.id, amount, currency: entry.currency, reason, details: { refundRequestId: request.id, cityLedgerEntryId: entry.id, category: request.category, requestedAmount: amount, requestedMethod, approverId: candidate?.userId, approverRoleId: role?.id, stepOrder: firstRule?.stepOrder || 1 }, expiresAt: request.expiresAt } });
      return request;
    });
    return successResponse({ status: result.status, refundRequest: result }, 202);
  } catch (error: any) {
    const messages: Record<string, [string, string, number]> = { NOT_FOUND: ['NOT_FOUND', 'Guest credit was not found.', 404], INVALID_CREDIT_ACCOUNT: ['CONFLICT', 'This ledger entry is not a guest refund liability.', 409], PAYMENT_NOT_FOUND: ['CONFLICT', 'The original completed payment could not be found.', 409], CREDIT_LIMIT_EXCEEDED: ['CONFLICT', 'The requested refund exceeds the available guest credit.', 409] };
    const mapped = messages[error.message];
    if (mapped) return errorResponse(mapped[0], mapped[1], mapped[2]);
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unable to create guest-credit refund request', 500);
  }
}

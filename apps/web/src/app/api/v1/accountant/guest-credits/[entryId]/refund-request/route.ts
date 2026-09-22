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
    const user = session.user as any;
    const role = String(user.role || '').toUpperCase();
    const canRequestRefund = ['FRONT_DESK', 'FRONT_DESK_MANAGER', 'RECEPTIONIST'].includes(role);
    if (!canRequestRefund) return errorResponse('FORBIDDEN', 'Refund request permission is required.', 403);
    const { entryId } = await params;
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const requestedMethod = String(body.refundMethod || 'ORIGINAL_PAYMENT').toUpperCase();
    const requestedAccountType = String(body.accountType || 'GUEST_CREDIT').toUpperCase();
    const isCorporateAdvance = requestedAccountType === 'CORPORATE';
    const reason = String(body.reason || '').trim();
    const idempotencyKey = String(body.idempotencyKey || '').trim() || `guest-credit-refund:${entryId}:${crypto.randomUUID()}`;
    const bankAccountName = String(body.bankAccountName || '').trim();
    const bankAccountNumber = String(body.bankAccountNumber || '').replace(/\s+/g, '');
    const bankName = String(body.bankName || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !reason || !['CASH', 'BANK_TRANSFER', 'ORIGINAL_PAYMENT'].includes(requestedMethod)) return errorResponse('BAD_REQUEST', 'Amount, reason, and a valid refund method are required.', 400);
    if (requestedMethod === 'BANK_TRANSFER' && (!bankAccountName || !/^\d{6,20}$/.test(bankAccountNumber) || !bankName)) return errorResponse('BAD_REQUEST', 'Bank name, account name, and a valid account number are required.', 400);

    const ctx = await requireOrganizationContext(session.user.id);
    const result = await prisma.$transaction(async tx => {
      const entry = await tx.cityLedgerEntry.findUnique({ where: { id: entryId }, include: { account: true, folio: { include: { property: true } }, reservation: true, allocations: true } });
      const validGuestCredit = entry?.type === 'REFUND_OWED' && Boolean(entry.guestId) && entry.account?.type === 'REFUND_PAYABLE';
      const validCorporateAdvance = entry?.type === 'PAYMENT' && !entry.guestId && entry.account?.type === 'CORPORATE';
      if (!entry || !ctx.propertyIds.includes(entry.propertyId) || (isCorporateAdvance ? !validCorporateAdvance : !validGuestCredit)) throw new Error('NOT_FOUND');
      if (isCorporateAdvance && requestedMethod === 'ORIGINAL_PAYMENT') throw new Error('PAYMENT_NOT_FOUND');
      const property = await tx.property.findUnique({ where: { id: entry.propertyId }, select: { organizationId: true } });
      const payment = entry.folioId ? await tx.payment.findFirst({ where: { folioId: entry.folioId, status: 'COMPLETED' }, orderBy: { createdAt: 'asc' } }) : null;
      if (!isCorporateAdvance && !payment && requestedMethod === 'ORIGINAL_PAYMENT') throw new Error('PAYMENT_NOT_FOUND');
      const allocated = entry.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
      const available = Number(entry.amount) - allocated;
      const pending = await tx.refundRequest.aggregate({ where: { cityLedgerEntryId: entry.id, status: { in: ACTIVE as any } }, _sum: { requestedAmount: true } });
      if (Number(pending._sum.requestedAmount || 0) + amount > available + 0.01) throw new Error('CREDIT_LIMIT_EXCEEDED');
      const existing = await tx.refundRequest.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      const rules = await tx.refundApprovalRule.findMany({ where: { propertyId: entry.propertyId, isActive: true }, orderBy: { stepOrder: 'asc' } });
      const matchingRules = rules.filter(rule => (rule.minAmount == null || amount >= Number(rule.minAmount)) && (rule.maxAmount == null || amount <= Number(rule.maxAmount)));
      const isStandalone = isCorporateAdvance || !entry.folioId || !payment;
      const accountantRole = isStandalone ? await tx.role.findFirst({ where: { organizationId: property?.organizationId || '', name: { in: ['ACCOUNTANT', 'FINANCE_MANAGER'] } } }) : null;
      const managerRole = isStandalone ? await tx.role.findFirst({ where: { organizationId: property?.organizationId || '', name: { in: ['MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER'] } } }) : null;
      const firstRule = isStandalone ? null : matchingRules[0];
      const firstRole = accountantRole || (firstRule?.roleId ? await tx.role.findUnique({ where: { id: firstRule.roleId } }) : null);
      const firstApprover = accountantRole ? await tx.userRole.findFirst({ where: { roleId: accountantRole.id, userId: { not: session.user.id }, OR: [{ propertyId: entry.propertyId }, { propertyId: null }] }, select: { userId: true } }) : null;
      const fallbackRoleName = amount > 250000 ? 'FINANCE_MANAGER' : amount > 50000 ? 'MANAGER' : 'FRONT_DESK_MANAGER';
      const role = firstRole || await tx.role.findFirst({ where: { organizationId: property?.organizationId || '', name: fallbackRoleName } });
      const candidate = firstApprover || (firstRule?.approverId ? { userId: firstRule.approverId } : role ? await tx.userRole.findFirst({ where: { roleId: role.id, userId: { not: session.user.id }, OR: [{ propertyId: entry.propertyId }, { propertyId: null }] }, select: { userId: true } }) : null);
      const request = await tx.refundRequest.create({ data: { organizationId: property?.organizationId || '', propertyId: entry.propertyId, reservationId: isCorporateAdvance ? null : entry.reservationId, folioId: isCorporateAdvance ? null : entry.folioId, ...(payment?.id && !isCorporateAdvance ? { paymentId: payment.id } : {}), guestId: isCorporateAdvance ? null : entry.guestId, cityLedgerEntryId: entry.id, requestedAmount: amount, currency: entry.currency, requestedMethod, bankAccountName: requestedMethod === 'BANK_TRANSFER' ? bankAccountName : null, bankAccountNumberEncrypted: requestedMethod === 'BANK_TRANSFER' ? encrypt(bankAccountNumber) : null, bankName: requestedMethod === 'BANK_TRANSFER' ? bankName : null, category: isCorporateAdvance ? 'CORPORATE_ADVANCE_BALANCE' : 'FOLIO_CREDIT_BALANCE', reason, supportingNotes: `${isCorporateAdvance ? 'Corporate advance' : 'Guest credit'} entry: ${entry.id}`, requestedById: session.user.id, currentApproverId: candidate?.userId, approvalRoleId: role?.id, currentApprovalStep: isStandalone ? 1 : (firstRule?.stepOrder || 1), idempotencyKey, expiresAt: new Date(Date.now() + 7 * 86400000) } });
      await tx.approvalRequest.create({ data: { propertyId: entry.propertyId, type: 'REFUND', status: 'PENDING', requestedBy: session.user.id, amount, currency: entry.currency, reason, details: { refundRequestId: request.id, cityLedgerEntryId: entry.id, category: request.category, requestedAmount: amount, requestedMethod, approverId: candidate?.userId, approverRoleId: role?.id, stepOrder: isStandalone ? 1 : (firstRule?.stepOrder || 1), stage: isStandalone ? 'ACCOUNTANT_REVIEW' : 'STANDARD_REVIEW' }, expiresAt: request.expiresAt } });
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

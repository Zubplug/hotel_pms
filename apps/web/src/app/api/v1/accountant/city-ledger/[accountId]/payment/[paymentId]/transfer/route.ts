import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/rbac';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

const ACCOUNTANT_ROLES = ['ACCOUNTANT', 'NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ accountId: string; paymentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { accountId, paymentId } = await params;
    const body = await req.json().catch(() => ({}));
    const targetAccountId = String(body.targetAccountId || '');
    const reason = String(body.reason || '').trim();
    if (!targetAccountId || targetAccountId === accountId) return errorResponse('BAD_REQUEST', 'A different target account is required.', 400);
    if (reason.length < 3) return errorResponse('BAD_REQUEST', 'A transfer reason is required.', 400);

    const ctx = await requireOrganizationContext(session.user.id);
    const [source, target] = await Promise.all([
      prisma.cityLedgerAccount.findUnique({ where: { id: accountId }, include: { property: true } }),
      prisma.cityLedgerAccount.findUnique({ where: { id: targetAccountId } }),
    ]);
    if (!source || !target || source.propertyId !== target.propertyId || !ctx.propertyIds.includes(source.propertyId)) return errorResponse('FORBIDDEN', 'Both city-ledger accounts must belong to the same accessible property.', 403);
    const role = session.user.role || 'UNKNOWN';
    const allowed = ACCOUNTANT_ROLES.includes(role) || await hasPermission(session.user.id, 'receivables', 'collect', source.propertyId);
    if (!allowed) return errorResponse('FORBIDDEN', 'Insufficient permissions to transfer receivables cash.', 403);

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "CityLedgerAccount" WHERE id IN (${accountId}::uuid, ${targetAccountId}::uuid) FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "CityLedgerEntry" WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const entry = await tx.cityLedgerEntry.findUnique({ where: { id: paymentId }, include: { allocations: true } });
      if (!entry || entry.accountId !== accountId || entry.type !== 'PAYMENT') throw new Error('PAYMENT_NOT_FOUND');
      if (entry.status === 'REVERSED') throw new Error('PAYMENT_REVERSED');
      if (entry.allocations.some(allocation => allocation.invoiceId)) throw new Error('PAYMENT_ALREADY_ALLOCATED');
      const amount = Number(entry.amount);
      // New corporate advances are held in GL 2300 and deliberately do not
      // change the AR subledger balance until they are allocated to an invoice.
      // Preserve the legacy account-credit transfer behaviour for older rows.
      const isLiabilityOnlyAdvance = source.type === 'CORPORATE'
        && entry.allocations.length === 0
        && Number(source.balance) >= -0.01
        && /unapplied corporate advance|awaiting allocation/i.test(entry.reason || '');
      await tx.cityLedgerEntry.update({ where: { id: paymentId }, data: { accountId: targetAccountId, reason: `Transferred from ${source.name}: ${reason}` } });
      if (!isLiabilityOnlyAdvance) {
        await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } });
        await tx.cityLedgerAccount.update({ where: { id: targetAccountId }, data: { balance: { decrement: amount } } });
      }
      await tx.auditLog.create({ data: { organizationId: source.property.organizationId, propertyId: source.propertyId, userId: session.user.id, userEmail: session.user.email, userRole: role, action: 'AR_PAYMENT_TRANSFERRED', resource: 'CityLedgerEntry', resourceId: paymentId, newValue: { fromAccountId: accountId, toAccountId: targetAccountId, amount, reason }, ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1', userAgent: req.headers.get('user-agent') || 'Unknown', requestId: req.headers.get('x-request-id') || crypto.randomUUID() } });
      return { paymentId, fromAccountId: accountId, toAccountId: targetAccountId };
    });
    return successResponse(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to transfer payment';
    if (message === 'PAYMENT_NOT_FOUND') return errorResponse('NOT_FOUND', 'Payment was not found for this account.', 404);
    if (message === 'PAYMENT_REVERSED') return errorResponse('CONFLICT', 'A reversed payment cannot be transferred.', 409);
    if (message === 'PAYMENT_ALREADY_ALLOCATED') return errorResponse('CONFLICT', 'Only fully unapplied payments can be transferred.', 409);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}

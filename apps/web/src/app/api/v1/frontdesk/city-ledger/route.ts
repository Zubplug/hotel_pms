import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/rbac';

const frontDeskRoles = ['FRONT_DESK', 'FRONT_DESK_MANAGER', 'RECEPTIONIST'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
  const ctx = await requireOrganizationContext(session.user.id);
  if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Property access required', 403);
  const entries = await prisma.cityLedgerEntry.findMany({
    where: {
      propertyId,
      OR: [
        { type: 'TRANSFER_IN', status: 'OPEN' },
        { type: 'PAYMENT', status: 'OPEN', account: { type: 'CORPORATE' } },
      ],
    },
    include: { account: true, invoice: true, allocations: true, guest: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const rows = entries.map(entry => {
    const paid = entry.type === 'PAYMENT'
      ? entry.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)
      : entry.allocations.filter(allocation => allocation.invoiceId === entry.invoiceId).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    return { entryId: entry.id, accountId: entry.accountId, invoiceId: entry.invoiceId, invoiceNumber: entry.type === 'PAYMENT' ? 'Corporate advance' : (entry.invoice?.invoiceNumber || entry.reference), entryKind: entry.type === 'PAYMENT' ? 'CORPORATE_ADVANCE' : 'CITY_LEDGER_INVOICE', accountType: entry.account.type, accountName: entry.account.name, guestName: entry.guest ? `${entry.guest.firstName} ${entry.guest.lastName}` : null, amount: Number(entry.amount), paidAmount: paid, outstandingAmount: Math.max(0, Number(entry.amount) - paid), currency: entry.currency, status: entry.status, reference: entry.reason, createdAt: entry.createdAt };
  }).filter(entry => entry.outstandingAmount > 0.01);
  const representedCorporateAccounts = new Set(rows.filter((entry) => entry.accountType === 'CORPORATE').map((entry) => entry.accountId));
  const activeCorporateAccounts = await prisma.corporateAccount.findMany({
    where: { propertyId, isActive: true, cityLedgerAccountId: { not: null }, cityLedgerAccount: { is: { status: 'ACTIVE' } } },
    select: { id: true, name: true, cityLedgerAccountId: true, cityLedgerAccount: { select: { currency: true } } },
    orderBy: { name: 'asc' },
  });
  for (const account of activeCorporateAccounts) {
    if (!account.cityLedgerAccountId || representedCorporateAccounts.has(account.cityLedgerAccountId)) continue;
    rows.push({ entryId: null, accountId: account.cityLedgerAccountId, invoiceId: null, invoiceNumber: 'No open invoice', entryKind: 'CORPORATE_ACCOUNT', accountType: 'CORPORATE', accountName: account.name, guestName: null, amount: 0, paidAmount: 0, outstandingAmount: 0, currency: account.cityLedgerAccount?.currency || 'NGN', status: 'ACTIVE', reference: null, createdAt: new Date() });
  }
  return successResponse(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const role = String(session.user.role || '').toUpperCase();
  const canCollect = frontDeskRoles.includes(role) || await hasPermission(session.user.id, 'receivables', 'collect', session.user.propertyId || '');
  if (!canCollect) return errorResponse('FORBIDDEN', 'Front Desk receivables collection permission required', 403);
  const body = await req.json().catch(() => ({}));
  const entryId = String(body.entryId || '');
  const accountId = String(body.accountId || '');
  const accountType = String(body.accountType || '').toUpperCase();
  const invoiceId = body.invoiceId ? String(body.invoiceId) : undefined;
  const amount = Number(body.amount);
  const method = String(body.method || 'BANK_TRANSFER').toUpperCase();
  const reference = String(body.reference || '').trim();
  const idempotencyKey = String(body.idempotencyKey || `frontdesk-city-ledger:${entryId}:${crypto.randomUUID()}`);
  if (!entryId || !Number.isFinite(amount) || amount <= 0 || !reference) return errorResponse('BAD_REQUEST', 'Entry, amount, and reference are required', 400);
  if (!['CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'CHEQUE', 'OTHER'].includes(method)) return errorResponse('BAD_REQUEST', 'Invalid settlement method', 400);
  const ctx = await requireOrganizationContext(session.user.id);
  const entry = await prisma.cityLedgerEntry.findUnique({ where: { id: entryId }, include: { account: true, invoice: true, allocations: true } });
  const isCorporateAdvance = entry?.type === 'PAYMENT' && entry.account.type === 'CORPORATE';
  if (!entry || !ctx.propertyIds.includes(entry.propertyId) || entry.status !== 'OPEN' || (entry.type !== 'TRANSFER_IN' && !isCorporateAdvance)) {
    return errorResponse('NOT_FOUND', 'Open city ledger entry not found', 404);
  }
  if (!accountId || accountId !== entry.accountId || !['CORPORATE', 'SKIPPER'].includes(accountType)) return errorResponse('BAD_REQUEST', 'A valid city ledger account and account type are required', 400);
  if (entry.account.type !== accountType) return errorResponse('CONFLICT', 'City ledger account type does not match the settlement', 409);
  if (accountType === 'SKIPPER') {
    if (!invoiceId || invoiceId !== entry.invoiceId) return errorResponse('BAD_REQUEST', 'Walkout settlement must identify its individual invoice', 400);
    const paid = entry.allocations.filter(allocation => allocation.invoiceId === invoiceId).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    if (amount > Number(entry.amount) - paid + 0.01) return errorResponse('CONFLICT', 'Settlement exceeds the walkout invoice balance', 409);
  }
  const frontdeskSession = await prisma.frontdeskSession.findFirst({ where: { propertyId: entry.propertyId, staffId: session.user.id, status: 'OPEN', controlStatus: 'OPEN' }, select: { id: true } });
  if (!frontdeskSession) return errorResponse('INVALID_STATE', 'An open Front Desk shift is required to post this payment', 409);
  const response = await fetch(new URL(`/api/v1/accountant/city-ledger/${accountId}/payment`, req.url), { method: 'POST', headers: { ...Object.fromEntries(req.headers.entries()), 'content-type': 'application/json' }, body: JSON.stringify({ amount, method, reference, frontdeskSessionId: frontdeskSession.id, ...(accountType === 'SKIPPER' ? { invoiceId } : {}), idempotencyKey }) });
  const payload = await response.json();
  return new Response(JSON.stringify(payload), { status: response.status, headers: { 'content-type': 'application/json' } });
}

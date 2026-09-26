import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const body = await req.json().catch(() => ({}));
  const accountId = String(body.accountId || '');
  const amount = Number(body.amount);
  const method = String(body.method || 'BANK_TRANSFER').toUpperCase();
  const reference = String(body.reference || '').trim();
  if (!accountId || !Number.isFinite(amount) || amount <= 0 || !reference) return errorResponse('BAD_REQUEST', 'Corporate account, positive amount, and reference are required', 400);
  if (!['CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'CHEQUE', 'OTHER'].includes(method)) return errorResponse('BAD_REQUEST', 'Invalid payment method', 400);
  const context = await requireOrganizationContext(session.user.id);
  const account = await prisma.cityLedgerAccount.findUnique({ where: { id: accountId } });
  if (!account || account.type !== 'CORPORATE' || !context.propertyIds.includes(account.propertyId) || account.status !== 'ACTIVE') return errorResponse('FORBIDDEN', 'Active corporate City Ledger account not found', 403);
  const frontdeskSession = await prisma.frontdeskSession.findFirst({ where: { propertyId: account.propertyId, staffId: session.user.id, status: 'OPEN', controlStatus: 'OPEN' }, select: { id: true } });
  if (!frontdeskSession) return errorResponse('INVALID_STATE', 'An open Front Desk shift is required to receive an advance', 409);
  const response = await fetch(new URL(`/api/v1/accountant/city-ledger/${accountId}/payment`, req.url), { method: 'POST', headers: { ...Object.fromEntries(req.headers.entries()), 'content-type': 'application/json' }, body: JSON.stringify({ amount, method, reference, frontdeskSessionId: frontdeskSession.id, idempotencyKey: String(body.idempotencyKey || `corporate-advance:${accountId}:${crypto.randomUUID()}`) }) });
  return new Response(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } });
}

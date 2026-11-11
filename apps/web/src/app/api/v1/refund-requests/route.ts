import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { decrypt } from '@/lib/encryption';
import { resolveUser } from '@/lib/resolve-user';
import { authenticateSyncRequest } from '@/lib/sync-auth';

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const propertyId = searchParams.get('propertyId');
  let allowedPropertyIds: string[];

  if (propertyId) {
    // Desktop/POS clients authenticate with a registered device token. The
    // same helper also accepts a normal web session for browser callers.
    const authResult = await authenticateSyncRequest(req, propertyId);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    allowedPropertyIds = [authResult.propertyId];
  } else {
    // The management dashboard historically requests all properties without
    // a propertyId, so retain its session-based access path.
    const user = await resolveUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    allowedPropertyIds = user.allowedProperties;
  }

  const requestedStatus = searchParams.get('status');
  const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED', 'EXPIRED'] as const;
  const status = validStatuses.includes(requestedStatus as typeof validStatuses[number]) ? requestedStatus as typeof validStatuses[number] : undefined;
  const requests = await prisma.refundRequest.findMany({
    where: { propertyId: { in: allowedPropertyIds }, ...(status ? { status } : {}) },
    include: { payment: true, approvals: { orderBy: { decidedAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  const approvals = await prisma.approvalRequest.findMany({
    where: { type: 'REFUND', propertyId: { in: allowedPropertyIds } },
    select: { id: true, status: true, details: true }
  });
  const approvalByRequest = new Map(approvals.map(approval => [String((approval.details as { refundRequestId?: string } | null)?.refundRequestId || ''), approval]));
  return NextResponse.json({ data: requests.map(({ bankAccountNumberEncrypted, ...request }) => ({
    ...request,
    bankAccountNumber: bankAccountNumberEncrypted ? (() => { try { return decrypt(bankAccountNumberEncrypted); } catch { return null; } })() : null,
    approval: approvalByRequest.get(request.id) || null,
  })) });
}

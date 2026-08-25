import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const requestedStatus = new URL(req.url).searchParams.get('status');
  const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED', 'EXPIRED'] as const;
  const status = validStatuses.includes(requestedStatus as typeof validStatuses[number]) ? requestedStatus as typeof validStatuses[number] : undefined;
  const requests = await prisma.refundRequest.findMany({
    where: { propertyId: { in: user.allowedProperties }, ...(status ? { status } : {}) },
    include: { payment: true, approvals: { orderBy: { decidedAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  const approvals = await prisma.approvalRequest.findMany({
    where: { type: 'REFUND', propertyId: { in: user.allowedProperties } },
    select: { id: true, status: true, details: true }
  });
  const approvalByRequest = new Map(approvals.map(approval => [String((approval.details as { refundRequestId?: string } | null)?.refundRequestId || ''), approval]));
  return NextResponse.json({ data: requests.map(({ bankAccountNumberEncrypted: _encrypted, ...request }) => ({ ...request, approval: approvalByRequest.get(request.id) || null })) });
}

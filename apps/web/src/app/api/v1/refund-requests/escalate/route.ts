import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';
import { successResponse, errorResponse } from '@/lib/api-response';
import { NotificationEngine } from '@/lib/notification-engine';

/** Finance/cron endpoint for refund requests that have exceeded the SLA. */
export async function POST(req: NextRequest) {
  const cronAuthorized = Boolean(process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`);
  const user = cronAuthorized ? null : await resolveUser(req);
  if (!cronAuthorized && !user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const propertyIds = cronAuthorized
    ? (await prisma.property.findMany({ select: { id: true } })).map((property) => property.id)
    : user?.allowedProperties || [];
  if (!propertyIds.length) return successResponse({ escalated: 0 }, 200);
  const ageHours = Math.max(1, Number((await req.json().catch(() => ({})))?.ageHours || 48));
  const cutoff = new Date(Date.now() - ageHours * 3_600_000);
  const requests = await prisma.refundRequest.findMany({
    where: { propertyId: { in: propertyIds }, createdAt: { lte: cutoff }, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING'] } },
    select: { id: true, propertyId: true, organizationId: true, requestedAmount: true, currency: true, createdAt: true },
  });
  await Promise.all(requests.map((request) => NotificationEngine.emit({
    type: 'REFUND_ESCALATION', organizationId: request.organizationId, propertyId: request.propertyId,
    entityType: 'refund-requests', entityId: request.id,
    idempotencyKey: `REFUND_ESCALATION_${request.id}_${cutoff.toISOString().slice(0, 10)}`,
    metadata: { amount: Number(request.requestedAmount), currency: request.currency, ageHours },
  })));
  return successResponse({ escalated: requests.length }, 200);
}

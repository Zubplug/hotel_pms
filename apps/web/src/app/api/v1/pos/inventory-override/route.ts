import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';
import { z } from 'zod';
import { requireOrganizationContext } from "@/lib/organization-access";

const RequestSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

/** Manager-authorized negative-stock approval. The returned approval id is
 * supplied with the payment request and is consumed by the stock ledger. */
export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_MANAGER'].includes(user.role) && !user.isSuperAdmin) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 });
  }
  const parsed = RequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'orderId and reason are required' }, { status: 400 });

  const order = await prisma.posOrder.findUnique({ where: { id: parsed.data.orderId }, select: { id: true, propertyId: true, total: true, status: true } });
  if (!order || ['CANCELLED', 'VOIDED'].includes(order.status)) return NextResponse.json({ error: 'Order is unavailable' }, { status: 404 });
  if (!user.allowedProperties.includes(order.propertyId)) return NextResponse.json({ error: 'Property access denied' }, { status: 403 });

  const approval = await prisma.approvalRequest.create({
    data: {
      propertyId: order.propertyId,
      type: 'INVENTORY_NEGATIVE_STOCK',
      status: 'APPROVED',
      requestedBy: user.id,
      reviewedBy: user.id,
      requestedAt: new Date(),
      reviewedAt: new Date(),
      amount: order.total,
      currency: 'NGN',
      reason: parsed.data.reason,
      details: { orderId: order.id, managerAuthorized: true },
    },
  });
  return NextResponse.json({ approvalId: approval.id, status: approval.status }, { status: 201 });
}

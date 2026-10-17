import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

const bodySchema = z.object({
  propertyId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
  investigationConfirmed: z.literal(true),
});

const allowedRoles = new Set([
  'NIGHT_AUDITOR', 'GENERAL_CASHIER', 'MANAGER', 'HOTEL_MANAGER',
  'ADMIN', 'SUPER_ADMIN', 'CEO', 'GENERAL_MANAGER', 'DIRECTOR', 'FINANCE_MANAGER',
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const role = String((session.user as any).role || '').toUpperCase();
    if (!allowedRoles.has(role)) return NextResponse.json({ error: 'Night Audit permission required' }, { status: 403 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Investigation confirmation and a reason of at least 5 characters are required' }, { status: 400 });

    const { orderId } = await params;
    const { propertyId, reason } = parsed.data;
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Property access required' }, { status: 403 });
    }

    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: { property: { select: { organizationId: true } } },
    });
    if (!order || order.propertyId !== propertyId) return NextResponse.json({ error: 'POS order not found' }, { status: 404 });
    if (['VOIDED', 'CANCELLED', 'CLOSED'].includes(order.status)) return NextResponse.json({ error: 'POS order is already resolved' }, { status: 409 });
    if (await isNightAuditTransactionLocked(order.propertyId, order.businessDate)) {
      return NextResponse.json({ error: 'POS order changes are temporarily paused while Night Audit is posting' }, { status: 409 });
    }

    const inventoryContext = {
      organizationId: order.property.organizationId,
      userId: session.user.id,
      role,
      permissions: [],
      propertyIds: [order.propertyId],
      outletIds: [order.outletId],
    } as any;
    await InventoryService.restoreSale(inventoryContext, order.id, session.user.id, `night_audit_void_${order.id}`);

    const updated = await prisma.posOrder.update({
      where: { id: order.id },
      data: {
        status: 'VOIDED',
        notes: `${order.notes || ''}\nNight Audit void: ${reason}`.trim(),
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: order.property.organizationId,
        propertyId: order.propertyId,
        userId: session.user.id,
        userEmail: session.user.email,
        userRole: role,
        action: 'NIGHT_AUDIT_POS_ORDER_VOIDED',
        resource: 'PosOrder',
        resourceId: order.id,
        previousValue: { status: order.status, paymentStatus: order.paymentStatus },
        newValue: { status: 'VOIDED', reason, investigationConfirmed: true, orderNumber: order.orderNumber },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
        requestId: crypto.randomUUID(),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('[night-audit void POS order]', error);
    return NextResponse.json({ error: 'Unable to void POS order' }, { status: 500 });
  }
}

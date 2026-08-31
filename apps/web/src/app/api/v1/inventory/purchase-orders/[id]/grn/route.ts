import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { ProcurementService } from '@/lib/inventory/ProcurementService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'inventory.receive', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { items, deliveryNoteRef } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findFirst({ where: { id: params.id, propertyId: ctx.propertyIds[0] }, select: { id: true } });
    if (!po) return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });

    if (await isNightAuditTransactionLocked(ctx.propertyIds[0])) {
      return NextResponse.json({ error: 'Goods receipt cannot be posted while Night Audit is posting. Retry after the new business date is active.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }

    const data = await ProcurementService.createGRN(params.id, userId, items, deliveryNoteRef);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

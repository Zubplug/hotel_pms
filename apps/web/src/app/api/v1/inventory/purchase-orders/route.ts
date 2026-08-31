import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma, { UnitOfMeasure } from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { resolveStockUnitConversion } from '@/lib/inventory/UnitConversionService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { ProcurementService } from '@/lib/inventory/ProcurementService';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');

    const where: any = { propertyId: ctx.propertyIds[0] };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: purchaseOrders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'procurement.po.create', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    
    if (await isNightAuditTransactionLocked(ctx.propertyIds[0])) {
      return NextResponse.json({ error: 'Purchase orders cannot be created while Night Audit is posting. Retry after the new business date is active.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }

    body.propertyId = ctx.propertyIds[0];
    const purchaseOrder = await ProcurementService.createPO(body, userId);

    return NextResponse.json({ data: purchaseOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

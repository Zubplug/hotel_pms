import { NextResponse } from 'next/server';
import { StockItemType } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';

export const dynamic = 'force-dynamic';

const LABELS: Record<StockItemType, string> = {
  SELLABLE: 'Sellable / Resale',
  RAW_MATERIAL: 'Raw Material / Production',
  CONSUMABLE: 'General Consumable',
  CLEANING: 'Cleaning',
  HOUSEKEEPING: 'Housekeeping',
  ASSET: 'Asset / Durable Equipment',
  PACKAGING: 'Packaging',
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });

    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', ctx.propertyIds[0]);
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
    }

    const types = (Object.values(StockItemType) as StockItemType[]).map((value) => ({ value, label: LABELS[value] }));
    return NextResponse.json({ data: types, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

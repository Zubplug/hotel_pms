import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { ProcurementService } from '@/lib/inventory/ProcurementService';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    if (!hasInventoryPermission(role, 'procurement.po.create', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await ProcurementService.submitPO(params.id, userId);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

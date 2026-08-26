import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { ProcurementService } from '@/lib/inventory/ProcurementService';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin, id: userId } = session.user as any;
    if (!hasInventoryPermission(role, 'procurement.po.approve', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required for rejection' }, { status: 400 });
    }

    const data = await ProcurementService.rejectPO(params.id, userId, reason);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

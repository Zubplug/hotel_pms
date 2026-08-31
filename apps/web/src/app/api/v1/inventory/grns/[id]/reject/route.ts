import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);

    if (!hasInventoryPermission(role, 'inventory.approve', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const reason = body.reason || 'No reason provided';

    const grn = await prisma.goodsReceivedNote.findFirst({
      where: { id: params.id, propertyId: ctx.propertyIds[0] }
    });

    if (!grn) {
      return NextResponse.json({ data: null, error: 'Not Found' }, { status: 404 });
    }

    const result = await InventoryService.rejectReceipt(params.id, userId, reason);

    return NextResponse.json({ data: result, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin } = session.user as any;

    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const transfer = await prisma.stockTransfer.updateMany({
      where: { 
        id: params.id, 
        propertyId,
        status: 'DRAFT'
      },
      data: {
        status: 'PENDING_APPROVAL'
      }
    });

    if (transfer.count === 0) {
      return NextResponse.json({ data: null, error: 'Transfer not found or not in DRAFT status' }, { status: 400 });
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

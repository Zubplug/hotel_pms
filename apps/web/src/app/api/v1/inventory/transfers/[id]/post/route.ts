import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { InventoryService } from '@/lib/inventory/InventoryService';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;

    const body = await request.json();
    const { operationId } = body;
    
    if (!operationId) {
      return NextResponse.json({ data: null, error: 'operationId is required' }, { status: 400 });
    }

    // Verify it belongs to property
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: params.id, propertyId }
    });

    if (!transfer) {
      return NextResponse.json({ data: null, error: 'Not Found' }, { status: 404 });
    }

    const canIssue = hasInventoryPermission(role, 'inventory.transfer.issue', isSuperAdmin);
    if (!canIssue) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const result = await InventoryService.postTransfer(params.id, userId, operationId);

    return NextResponse.json({ data: result, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

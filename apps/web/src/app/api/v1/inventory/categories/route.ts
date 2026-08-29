import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });

    const { role, propertyId, isSuperAdmin } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get('limit') || 100);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
    const categories = await prisma.inventoryCategory.findMany({
      where: { propertyId, isActive: true },
      orderBy: { name: 'asc' },
      take: limit,
      select: { id: true, name: true },
    });

    return NextResponse.json({ data: { items: categories, total: categories.length }, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error', data: null }, { status: 500 });
  }
}

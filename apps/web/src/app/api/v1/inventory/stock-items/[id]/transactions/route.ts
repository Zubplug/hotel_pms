import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const item = await prisma.stockItem.findFirst({
            where: { id: params.id, propertyId },
        });

        if (!item) return NextResponse.json({ error: 'Stock item not found', data: null }, { status: 404 });

        const { searchParams } = new URL(request.url);
        const source = searchParams.get('source');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '30', 10);
        const skip = (page - 1) * limit;

        const where: any = { stockItemId: params.id };
        if (source) {
            where.source = source;
        }

        const [transactions, total] = await Promise.all([
            prisma.stockTransaction.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: limit,
            }),
            prisma.stockTransaction.count({ where }),
        ]);

        return NextResponse.json({ data: { transactions, total, page, limit }, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

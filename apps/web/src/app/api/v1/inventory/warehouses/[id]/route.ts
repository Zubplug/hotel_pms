import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const warehouse = await prisma.warehouse.findFirst({
            where: { id: params.id, propertyId },
            include: {
                stockItems: {
                    select: {
                        id: true,
                        name: true,
                        quantityOnHand: true,
                    },
                },
            },
        });

        if (!warehouse) return NextResponse.json({ error: 'Warehouse not found', data: null }, { status: 404 });

        return NextResponse.json({ data: warehouse, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, propertyId, isSuperAdmin } = session.user as any;
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { name, location, isActive } = body;

        const existing = await prisma.warehouse.findFirst({
            where: { id: params.id, propertyId },
        });

        if (!existing) return NextResponse.json({ error: 'Warehouse not found', data: null }, { status: 404 });

        const updated = await prisma.warehouse.update({
            where: { id: params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(location !== undefined && { location }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        return NextResponse.json({ data: updated, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

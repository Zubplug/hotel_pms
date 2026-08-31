import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const warehouses = await prisma.warehouse.findMany({
            where: { propertyId: { in: ctx.propertyIds as string[] } },
            include: {
                posOutlet: { select: { id: true, name: true, type: true } },
                _count: {
                    select: { stockItems: true },
                },
            },
        });

        return NextResponse.json({ data: warehouses, error: null });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
        if (!hasInventoryPermission(role, 'inventory.manage', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const body = await request.json();
        const { name, location } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required', data: null }, { status: 400 });
        }

        const warehouse = await prisma.warehouse.create({
            data: {
                propertyId: ctx.propertyIds[0],
                name,
                location,
            },
        });

        return NextResponse.json({ data: warehouse, error: null }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, data: null }, { status: 500 });
    }
}

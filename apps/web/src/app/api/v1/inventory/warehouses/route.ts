import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";
import { requireInventoryAccess } from '@/lib/auth/inventory-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
        const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireInventoryAccess(session.user.id);
        if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });

        const where: any = { propertyId: { in: ctx.propertyIds as string[] } };
        const scope = new URL(request.url).searchParams.get('scope');
        // Restrict to assigned outlets + main warehouses unless the user is a high-level admin or stock manager
        if (scope === 'outlet' && !['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_CASHIER', 'STOCK_MANAGER', 'STOCK_KEEPER'].includes(role)) {
            // F&B requisitions need both the assigned outlet(s) and the
            // property's mother warehouse(s) so the request can choose its
            // source while still hiding other operational outlets.
            where.OR = [
                { posOutletId: { in: ctx.outletIds as string[] } },
                { posOutletId: null },
            ];
        } else if (!['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'GENERAL_MANAGER', 'GENERAL_CASHIER', 'STOCK_MANAGER', 'STOCK_KEEPER'].includes(role)) {
            where.OR = [
                { posOutletId: { in: ctx.outletIds as string[] } },
                { posOutletId: null }
            ];
        }

        const warehouses = await prisma.warehouse.findMany({
            where,
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
    const ctx = await requireInventoryAccess(session.user.id);
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

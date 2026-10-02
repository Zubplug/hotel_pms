import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hash } from 'bcryptjs';
import { requirePlanLimit } from '@/lib/auth/entitlement';
import { requireModuleAccess } from '@/lib/auth/module-access';

const OPERATIONS_POSITIONS = new Set([
  'WAITER', 'WAITRESS', 'CASHIER', 'POS', 'POS_OPERATOR', 'POS_CASHIER',
  'FNB_MANAGER', 'F&B_MANAGER', 'FB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER',
  'HOUSEKEEPER', 'HOUSEKEEPING', 'MAINTENANCE', 'MAINTENANCE_MANAGER',
  'INVENTORY_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER', 'PROCUREMENT_MANAGER',
  'OUTLET_HEAD', 'LAUNDRY', 'LAUNDRY_MANAGER',
]);

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId') || (session.user as any).propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    const staffList = await prisma.staff.findMany({
      where: {
        propertyAccess: { has: propertyId },
      },
      include: {
        outletAccess: {
          include: {
            outlet: {
              select: { id: true, name: true }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ data: staffList });
  } catch (error) {
    console.error('Failed to fetch staff:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPER_ADMIN', 'ADMIN', 'CEO', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR'].includes(String(session.user.role || '').toUpperCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const propertyId = (session.user as any).propertyId;
    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    const body = await req.json();
    const { firstName, lastName, email, department, position, posPin, posOutlets } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }

    const organizationId = (session.user as any).organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Session is missing organizationId' }, { status: 403 });
    }

    const normalizedPosition = String(position || '').trim().toUpperCase().replace(/[ -]+/g, '_');
    if (OPERATIONS_POSITIONS.has(normalizedPosition)) {
      try {
        await requireModuleAccess(session.user.id, 'MODULE_OPERATIONS', propertyId);
      } catch {
        return NextResponse.json({ error: `${normalizedPosition.replaceAll('_', ' ')} staff require the Professional plan or higher` }, { status: 402 });
      }
    }

    const currentStaffCount = await prisma.staff.count({ where: { organizationId, isActive: true, deletedAt: null } });
    await requirePlanLimit(organizationId, 'maxUsers', currentStaffCount);

    let posPinHash = null;
    if (posPin && posPin.length === 4) {
      posPinHash = await hash(posPin, 10);
    }

    const newStaff = await prisma.$transaction(async (tx: any) => {
      const staff = await tx.staff.create({
        data: {
          organizationId,
          email,
          firstName: String(firstName),
          lastName: String(lastName),
          department: department ? String(department) : 'General',
          position: position ? String(position) : 'Staff',
          posPinHash,
          propertyAccess: [propertyId],
        }
      });

      if (posOutlets && Array.isArray(posOutlets) && posOutlets.length > 0) {
        await tx.staffPosOutletAccess.createMany({
          data: posOutlets.map((outletId: string) => ({
            staffId: staff.id,
            outletId,
            assignedBy: session.user.id
          }))
        });
      }

      return staff;
    });

    return NextResponse.json({ data: newStaff }, { status: 201 });
  } catch (error) {
    console.error('Failed to create staff:', error);
    if (error instanceof Error && /limit exceeded|active subscription/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

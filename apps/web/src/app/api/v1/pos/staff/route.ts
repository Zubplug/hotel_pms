import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId') || (session.user as any).propertyId;
    const outletId = searchParams.get('outletId');

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    let staff;

    if (outletId) {
      // Outlet-scoped: only return staff explicitly assigned to this outlet.
      // Prisma to-one includes don't support `where`, so we filter in JS.
      const outletAccess = await prisma.staffPosOutletAccess.findMany({
        where: { outletId },
        include: { staff: true }
      });
      staff = outletAccess
        .map(a => a.staff)
        .filter(s => s && s.isActive && ['WAITER', 'WAITRESS', 'CASHIER'].includes(s.position))
        .map(s => ({
          id: s!.id,
          firstName: s!.firstName,
          lastName: s!.lastName,
          department: s!.department,
          position: s!.position,
        }))
        .sort((a, b) => a.firstName.localeCompare(b.firstName));
    } else {
      // Fallback: property-level query (for admin/manager views)
      staff = await prisma.staff.findMany({
        where: {
          propertyAccess: { has: propertyId },
          isActive: true,
          position: { in: ['WAITER', 'WAITRESS', 'CASHIER'] },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
          position: true,
        },
        orderBy: { firstName: 'asc' }
      });
    }

    return NextResponse.json({ data: staff });
  } catch (error) {
    console.error('Failed to fetch POS staff:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

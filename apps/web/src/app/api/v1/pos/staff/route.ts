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
    let outletId = searchParams.get('outletId');
    const deviceIdentifier = searchParams.get('deviceId');

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }
    if (!ctx.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'Property access required' }, { status: 403 });
    }

    // On the first operator login there is no POS session yet, so the UI may
    // not have an outletId. Resolve the registered terminal instead, ensuring
    // the staff list is outlet-scoped from the very first login.
    if (!outletId && deviceIdentifier) {
      const device = await prisma.posDevice.findUnique({
        where: { identifier: deviceIdentifier },
        select: { propertyId: true, outletId: true },
      });
      if (device?.propertyId === propertyId) outletId = device.outletId;
    }
    if (outletId && !ctx.outletIds.includes(outletId)) {
      return NextResponse.json({ error: 'Outlet access required' }, { status: 403 });
    }

    let staff;

      // Staff positions are stored as free-form text and older records use
      // spaces, hyphens, or underscores interchangeably. Keep this allow-list
      // broad enough for both POS and pool terminals, then compare normalized
      // values so valid staff are not hidden by spelling differences.
      const allowedPositions = [
        'WAITER', 'WAITRESS', 'CASHIER', 'POS', 'POS_OPERATOR', 'POS_CASHIER',
        'MANAGER', 'GENERAL_MANAGER', 'FNB_MANAGER', 'HOTEL_MANAGER',
        'FRONT_DESK_MANAGER', 'FINANCE_MANAGER', 'GENERAL_CASHIER',
        'NIGHT_AUDITOR', 'CEO', 'OWNER', 'ADMIN', 'SUPER_ADMIN',
        'POOL_OPERATOR', 'POOL_MANAGER', 'SWIMMING_POOL_OPERATOR',
        'SWIMMING_POOL_MANAGER',
      ];
      const normalizePosition = (position: unknown) => String(position ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      const allowedPositionKeys = new Set(allowedPositions.map(normalizePosition));
      if (outletId) {
      // Outlet-scoped: only return staff explicitly assigned to this outlet.
      // Prisma to-one includes don't support `where`, so we filter in JS.
      const outletAccess = await prisma.staffPosOutletAccess.findMany({
        where: { outletId, outlet: { propertyId } },
        include: { staff: true }
      });
      staff = outletAccess
        .map(a => a.staff)
        .filter(s => s && s.isActive && s.propertyAccess.includes(propertyId) && s.organizationId === ctx.organizationId && allowedPositionKeys.has(normalizePosition(s.position)))
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
          organizationId: ctx.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
          position: true,
        },
        orderBy: { firstName: 'asc' }
      }).then(rows => rows.filter(s => allowedPositionKeys.has(normalizePosition(s.position))));
    }

    return NextResponse.json({ data: staff });
  } catch (error) {
    console.error('Failed to fetch POS staff:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

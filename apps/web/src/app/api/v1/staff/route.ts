import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hash } from 'bcryptjs';

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
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER')) {
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

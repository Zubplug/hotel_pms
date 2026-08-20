import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hash } from 'bcryptjs';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { firstName, lastName, department, position, posPin, posOutlets, isActive } = body;

    const existingStaff = await prisma.staff.findUnique({ where: { id } });
    if (!existingStaff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    let posPinHash = existingStaff.posPinHash;
    if (posPin && posPin.length === 4) {
      posPinHash = await hash(posPin, 10);
    }

    const updatedStaff = await prisma.$transaction(async (tx: any) => {
      // Update basic details
      const staff = await tx.staff.update({
        where: { id },
        data: {
          firstName: firstName ? String(firstName) : existingStaff.firstName,
          lastName: lastName ? String(lastName) : existingStaff.lastName,
          department: department !== undefined ? (department ? String(department) : 'General') : existingStaff.department,
          position: position !== undefined ? (position ? String(position) : 'Staff') : existingStaff.position,
          posPinHash,
          isActive: isActive !== undefined ? isActive : existingStaff.isActive
        }
      });

      // Update POS Outlet access
      if (posOutlets && Array.isArray(posOutlets)) {
        // Delete all existing assignments
        await tx.staffPosOutletAccess.deleteMany({
          where: { staffId: id }
        });

        // Create new assignments
        if (posOutlets.length > 0) {
          await tx.staffPosOutletAccess.createMany({
            data: posOutlets.map((outletId: string) => ({
              staffId: id,
              outletId,
              assignedBy: session.user.id
            }))
          });
        }
      }

      return staff;
    });

    return NextResponse.json({ data: updatedStaff });
  } catch (error) {
    console.error('Failed to update staff:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete by setting isActive to false
    const staff = await prisma.staff.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ data: staff });
  } catch (error) {
    console.error('Failed to delete staff:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

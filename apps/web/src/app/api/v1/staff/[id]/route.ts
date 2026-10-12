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
    
    if (!session?.user || !['SUPER_ADMIN', 'HOTEL_MANAGER', 'DIRECTOR'].includes(String(session.user.role || '').toUpperCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { firstName, lastName, department, position, posPin, posOutlets, isActive, selfServicePassword } = body;

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

      if (selfServicePassword) {
        if (String(selfServicePassword).length < 8) throw new Error('Self-service password must be at least 8 characters');
        const normalizedEmail = existingStaff.email.trim().toLowerCase();
        const existingUser = existingStaff.userId
          ? await tx.user.findUnique({ where: { id: existingStaff.userId } })
          : await tx.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser?.staffId && existingUser.staffId !== id) throw new Error('A web account already belongs to another employee with this email address');
        const user = existingUser
          ? await tx.user.update({ where: { id: existingUser.id }, data: { passwordHash: await hash(String(selfServicePassword), 12), staffId: id } })
          : await tx.user.create({ data: { email: normalizedEmail, passwordHash: await hash(String(selfServicePassword), 12), staffId: id } });
        await tx.staff.update({ where: { id }, data: { userId: user.id, employeeId: existingStaff.employeeId || `EMP-${id.replace(/-/g, '').slice(0, 12).toUpperCase()}` } });
        await tx.organizationMembership.upsert({ where: { userId: user.id }, update: { organizationId: existingStaff.organizationId, status: 'ACTIVE', role: 'MEMBER' }, create: { userId: user.id, organizationId: existingStaff.organizationId, status: 'ACTIVE', role: 'MEMBER' } });
      }

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
    
    if (!session?.user || !['SUPER_ADMIN', 'HOTEL_MANAGER', 'DIRECTOR'].includes(String(session.user.role || '').toUpperCase())) {
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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { propertyId, name, identifier, outletId, adminEmail, adminPassword } = await req.json();

    // Check permissions
    let hasPermission = session.user.role === 'SUPER_ADMIN' || session.user.role === 'HOTEL_MANAGER';
    
    // Admin override check
    if (!hasPermission) {
      if (!adminEmail || !adminPassword) {
        return NextResponse.json({ error: 'Forbidden: Admin credentials required to authorize this device.' }, { status: 403 });
      }

      const adminUser = await prisma.user.findUnique({
        where: { email: adminEmail },
        include: { roles: { include: { role: true } } }
      });

      if (!adminUser || !adminUser.passwordHash) {
        return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
      }

      const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.passwordHash);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
      }

      const primaryRole = adminUser.isSuperAdmin 
        ? 'SUPER_ADMIN' 
        : adminUser.roles[0]?.role?.name;

      if (primaryRole !== 'SUPER_ADMIN' && primaryRole !== 'HOTEL_MANAGER') {
        return NextResponse.json({ error: 'The provided account does not have sufficient permissions.' }, { status: 403 });
      }
      
      hasPermission = true;
    }

    if (!propertyId || !name || !identifier) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, name, identifier' },
        { status: 400 }
      );
    }

    // Verify property
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Check if device already exists
    const existingDevice = await prisma.posDevice.findUnique({
      where: { identifier }
    });

    if (existingDevice) {
      return NextResponse.json(
        { error: 'Device with this identifier already exists' },
        { status: 409 }
      );
    }

    // Verify outlet if provided
    if (outletId) {
      try {
        const outlet = await prisma.posOutlet.findUnique({
          where: { id: outletId, propertyId }
        });
        
        if (!outlet) {
          return NextResponse.json(
            { error: 'Outlet not found or does not belong to the property' },
            { status: 400 }
          );
        }
      } catch (err: any) {
        if (err.code === 'P2023') { // Prisma invalid UUID
           return NextResponse.json(
            { error: 'Invalid Outlet ID format' },
            { status: 400 }
          );
        }
        throw err;
      }
    }

    // Create the device as ACTIVE since it's being registered by an admin directly
    const device = await prisma.posDevice.create({
      data: {
        propertyId,
        name,
        identifier,
        outletId: outletId || null,
        status: 'ACTIVE',
        lastSeenAt: new Date()
      }
    });

    return NextResponse.json({
      message: 'Device registered successfully',
      device
    });
  } catch (error: any) {
    console.error('Failed to register POS device:', error);
    return NextResponse.json(
      { error: 'Failed to register POS device', details: error.message },
      { status: 500 }
    );
  }
}

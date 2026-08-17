import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Admins or Hotel Managers can register a device
    if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to register POS devices' }, { status: 403 });
    }

    const { propertyId, name, identifier, outletId } = await req.json();

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
      const outlet = await prisma.posOutlet.findUnique({
        where: { id: outletId, propertyId }
      });
      
      if (!outlet) {
        return NextResponse.json(
          { error: 'Outlet not found or does not belong to the property' },
          { status: 400 }
        );
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

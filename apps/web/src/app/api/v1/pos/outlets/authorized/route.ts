import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');
    const propertyId = searchParams.get('propertyId');

    if (!deviceId || !propertyId) {
      return NextResponse.json(
        { error: 'Missing required query parameters: deviceId, propertyId' },
        { status: 400 }
      );
    }

    // 1. Get the authenticated Staff Identity
    const staffId = session.user.staffId;
    if (!staffId && session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER') {
      return NextResponse.json({ error: 'Forbidden: No staff profile linked' }, { status: 403 });
    }

    // 2. Validate the Device
    const device = await prisma.posDevice.findUnique({
      where: { identifier: deviceId }
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (device.propertyId !== propertyId) {
      return NextResponse.json({ error: 'Device does not belong to this property' }, { status: 403 });
    }

    if (device.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Device is not active (Status: ${device.status})` },
        { status: 403 }
      );
    }

    // 3. Find Outlets Staff is Authorized for
    let authorizedOutlets = [];
    
    // Super Admins and Hotel Managers can access all outlets for the property
    if (session.user.role === 'SUPER_ADMIN' || session.user.role === 'HOTEL_MANAGER') {
      authorizedOutlets = await prisma.posOutlet.findMany({
        where: { propertyId, isActive: true }
      });
    } else {
      const staffAccess = await prisma.staffPosOutletAccess.findMany({
        where: { staffId },
        include: { outlet: true }
      });
      authorizedOutlets = staffAccess
        .filter(access => access.outlet.isActive && access.outlet.propertyId === propertyId)
        .map(access => access.outlet);
    }

    // 4. Apply Intersection Logic (Device Binding)
    if (device.outletId) {
      // Device is strictly bound to one outlet
      const boundOutlet = authorizedOutlets.find(o => o.id === device.outletId);
      
      if (boundOutlet) {
        return NextResponse.json({
          outlets: [boundOutlet],
          device: { id: device.id, name: device.name, identifier: device.identifier }
        });
      } else {
        // Staff is not authorized for the bound outlet
        return NextResponse.json({
          outlets: [],
          device: { id: device.id, name: device.name, identifier: device.identifier },
          error: 'You are not authorized to use the outlet bound to this device.'
        });
      }
    }

    // Device is unbound, return all authorized outlets
    return NextResponse.json({
      outlets: authorizedOutlets,
      device: { id: device.id, name: device.name, identifier: device.identifier }
    });

  } catch (error: any) {
    console.error('Failed to fetch authorized outlets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch authorized outlets', details: error.message },
      { status: 500 }
    );
  }
}

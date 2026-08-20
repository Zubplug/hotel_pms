import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staffId = session.user.staffId;
    if (!staffId && session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER') {
      return NextResponse.json({ error: 'Forbidden: No staff profile linked' }, { status: 403 });
    }

    const data = await req.json();
    // Use token propertyId if available, else from payload
    const propertyId = (session.user as any).propertyId || data.propertyId;
    const { deviceId, outletId, openingCash } = data;

    if (!propertyId || !deviceId || !outletId) {
      return NextResponse.json({ error: 'Missing required fields: propertyId, deviceId, outletId' }, { status: 400 });
    }

    // 1. Verify Device is ACTIVE and belongs to Property
    const device = await prisma.posDevice.findUnique({
      where: { identifier: deviceId }
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (device.propertyId !== propertyId || device.status !== 'ACTIVE') {
      return NextResponse.json({ error: `Device is invalid or not active (Status: ${device?.status})` }, { status: 403 });
    }

    // 2. Validate Device-Outlet binding
    if (device.outletId && device.outletId !== outletId) {
      return NextResponse.json({ error: 'This device is physically bound to a different outlet' }, { status: 403 });
    }

    // 3. Verify Outlet exists
    const outlet = await prisma.posOutlet.findUnique({
      where: { id: outletId }
    });

    if (!outlet || outlet.propertyId !== propertyId || !outlet.isActive) {
      return NextResponse.json({ error: 'Outlet is invalid or inactive' }, { status: 400 });
    }

    // 4. Verify Staff has access to Outlet
    if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER') {
      const access = await prisma.staffPosOutletAccess.findUnique({
        where: {
          staffId_outletId: {
            staffId: staffId as string,
            outletId: outlet.id
          }
        }
      });

      if (!access) {
        return NextResponse.json({ error: 'You are not authorized to open a session at this outlet' }, { status: 403 });
      }
    }

    // 5. Transaction to check for existing OPEN session on this DEVICE and create new
    const result = await prisma.$transaction(async (tx: any) => {
      const existingSession = await tx.posSession.findFirst({
        where: {
          deviceId: device.id,
          status: 'OPEN'
        }
      });

      if (existingSession) {
        // If it's the exact same user/outlet trying to reconnect, return it
        if (existingSession.openedBy === session.user.id && existingSession.outletId === outlet.id) {
          return existingSession;
        }
        throw new Error('This terminal already has an OPEN financial session by another cashier.');
      }

      // Create the PosSession
      return tx.posSession.create({
        data: {
          propertyId: propertyId,
          outletId: outlet.id,
          deviceId: device.id,
          businessDate: new Date(),
          openingCash: openingCash || 0,
          expectedCash: openingCash || 0,
          openedBy: session.user.id, // Cashier who opens the drawer
          status: 'OPEN'
        }
      });
    });

    return NextResponse.json({ data: { sessionId: result.id } });

  } catch (error: any) {
    console.error('Error starting POS session:', error);
    // If it's our transaction throw
    if (error.message.includes('already has an OPEN')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
